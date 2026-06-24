package email

import (
	"crypto/tls"
	"fmt"
	"net/smtp"
	"strings"
)

type EmailService interface {
	SendVerificationEmail(to, name, token string) error
	SendPasswordResetEmail(to, name, token string) error
	SendWelcomeEmail(to, name string) error
	SendWorkspaceInviteEmail(to, inviterName, workspaceName, token string) error
}

type smtpService struct {
	host     string
	port     string
	user     string
	pass     string
	from     string
	appURL   string
	enabled  bool
}

func NewSMTPService(host, port, user, pass, appURL string) EmailService {
	return &smtpService{
		host:    host,
		port:    port,
		user:    user,
		pass:    pass,
		from:    user,
		appURL:  appURL,
		enabled: host != "" && user != "" && pass != "",
	}
}

func (s *smtpService) send(to, subject, body string) error {
	if !s.enabled {
		// Log to stdout when SMTP not configured (dev mode)
		fmt.Printf("[EMAIL] To: %s | Subject: %s\n%s\n---\n", to, subject, body)
		return nil
	}

	headers := fmt.Sprintf("From: FinTrackr <%s>\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n", s.from, to, subject)
	message := headers + body

	addr := fmt.Sprintf("%s:%s", s.host, s.port)

	if s.port == "465" {
		// SSL
		tlsConfig := &tls.Config{
			InsecureSkipVerify: false,
			ServerName:         s.host,
		}
		conn, err := tls.Dial("tcp", addr, tlsConfig)
		if err != nil {
			return fmt.Errorf("tls dial: %w", err)
		}
		defer conn.Close()

		client, err := smtp.NewClient(conn, s.host)
		if err != nil {
			return err
		}
		defer client.Close()

		if err := client.Auth(smtp.PlainAuth("", s.user, s.pass, s.host)); err != nil {
			return err
		}
		if err := client.Mail(s.from); err != nil {
			return err
		}
		if err := client.Rcpt(to); err != nil {
			return err
		}
		w, err := client.Data()
		if err != nil {
			return err
		}
		_, err = fmt.Fprint(w, message)
		if err != nil {
			return err
		}
		return w.Close()
	}

	// STARTTLS (port 587)
	auth := smtp.PlainAuth("", s.user, s.pass, s.host)
	return smtp.SendMail(addr, auth, s.from, []string{to}, []byte(message))
}

func (s *smtpService) SendVerificationEmail(to, name, token string) error {
	verifyURL := fmt.Sprintf("%s/verify-email?token=%s", s.appURL, token)
	body := emailTemplate("Verifikasi Email Kamu", fmt.Sprintf(`
		<p>Halo <strong>%s</strong>,</p>
		<p>Terima kasih sudah mendaftar di FamLedger! Klik tombol di bawah untuk memverifikasi email kamu.</p>
		<p style="text-align:center; margin: 32px 0;">
			<a href="%s" style="background:#6B8E6B;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-family:Nunito,system-ui,sans-serif;">Verifikasi Email</a>
		</p>
		<p>Link berlaku selama <strong>24 jam</strong>. Jika kamu tidak mendaftar, abaikan email ini.</p>
		<p style="font-size:12px;color:#888;">Atau salin link berikut: <br><a href="%s">%s</a></p>
	`, name, verifyURL, verifyURL, verifyURL))
	return s.send(to, "Verifikasi Email FamLedger", body)
}

func (s *smtpService) SendPasswordResetEmail(to, name, token string) error {
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", s.appURL, token)
	body := emailTemplate("Reset Password", fmt.Sprintf(`
		<p>Halo <strong>%s</strong>,</p>
		<p>Kami menerima permintaan reset password untuk akun FinTrackr kamu.</p>
		<p style="text-align:center; margin: 32px 0;">
			<a href="%s" style="background:#C66B6B;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-family:Nunito,system-ui,sans-serif;">Reset Password</a>
		</p>
		<p>Link berlaku selama <strong>1 jam</strong>. Jika kamu tidak meminta reset password, abaikan email ini.</p>
		<p style="font-size:12px;color:#888;">Atau salin link berikut: <br><a href="%s">%s</a></p>
	`, name, resetURL, resetURL, resetURL))
	return s.send(to, "Reset Password FamLedger", body)
}

func (s *smtpService) SendWelcomeEmail(to, name string) error {
	body := emailTemplate("Selamat Datang!", fmt.Sprintf(`
		<p>Halo <strong>%s</strong>,</p>
		<p>Selamat datang di FinTrackr! Akun kamu sudah aktif dan siap digunakan.</p>
		<p>Mulai kelola keuangan keluargamu dengan mudah:</p>
		<ul>
			<li>📊 Dashboard ringkasan keuangan bulanan</li>
			<li>💸 Catat pemasukan dan pengeluaran</li>
			<li>🏦 Kelola multiple rekening</li>
			<li>📉 Buat budget dan pantau progress</li>
		</ul>
		<p style="text-align:center; margin: 32px 0;">
			<a href="%s" style="background:#6B8E6B;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-family:Nunito,system-ui,sans-serif;">Buka FinTrackr</a>
		</p>
	`, name, s.appURL))
	return s.send(to, "Selamat Datang di FamLedger! 🌿", body)
}

func (s *smtpService) SendWorkspaceInviteEmail(to, inviterName, workspaceName, token string) error {
	acceptURL := fmt.Sprintf("%s/workspace/accept-invite?token=%s", s.appURL, token)
	body := emailTemplate("Undangan Workspace", fmt.Sprintf(`
		<p>Halo,</p>
		<p><strong>%s</strong> mengundang kamu untuk bergabung ke workspace <strong>%s</strong> di FamLedger.</p>
		<p style="text-align:center; margin: 32px 0;">
			<a href="%s" style="background:#6B8E6B;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-family:Nunito,system-ui,sans-serif;">Terima Undangan</a>
		</p>
		<p>Link berlaku selama <strong>7 hari</strong>. Jika kamu tidak mengenal pengirim, abaikan email ini.</p>
	`, inviterName, workspaceName, acceptURL))
	return s.send(to, fmt.Sprintf("Undangan Workspace %s - FamLedger 🌿", workspaceName), body)
}

func emailTemplate(title, content string) string {
	return strings.TrimSpace(fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:'Nunito','Segoe UI',system-ui,sans-serif;background:#FAF7F2;margin:0;padding:20px;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(45,42,38,0.08);">
    <!-- Header sage gradient -->
    <div style="background:linear-gradient(160deg,#6B8E6B 0%%,#41594F 100%%);padding:28px 32px;position:relative;overflow:hidden;">
      <!-- Decorative blob -->
      <div style="position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%%;background:#C97B5C;opacity:0.25;"></div>
      <div style="position:relative;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:24px;">🌿</span>
          <span style="color:#ffffff;font-size:22px;font-weight:900;letter-spacing:-0.5px;">FamLedger.</span>
        </div>
        <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;font-weight:600;letter-spacing:0.3px;">%s</p>
      </div>
    </div>
    <!-- Body -->
    <div style="padding:32px;color:#2D2A26;line-height:1.7;font-size:15px;">
      %s
    </div>
    <!-- Footer -->
    <div style="padding:16px 32px;background:#F4EEE3;text-align:center;font-size:12px;color:#8E887F;border-top:1px solid #ECE4D3;">
      FamLedger · Self-Hosted Family Finance Tracker 🌿<br>
      Email ini dikirim otomatis, jangan dibalas.
    </div>
  </div>
</body>
</html>`, title, content))
}
