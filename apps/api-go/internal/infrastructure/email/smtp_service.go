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
		<p>Terima kasih sudah mendaftar di FinTrackr! Klik tombol di bawah untuk memverifikasi email kamu.</p>
		<p style="text-align:center; margin: 32px 0;">
			<a href="%s" style="background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Verifikasi Email</a>
		</p>
		<p>Link berlaku selama <strong>24 jam</strong>. Jika kamu tidak mendaftar, abaikan email ini.</p>
		<p style="font-size:12px;color:#888;">Atau salin link berikut: <br><a href="%s">%s</a></p>
	`, name, verifyURL, verifyURL, verifyURL))
	return s.send(to, "Verifikasi Email FinTrackr", body)
}

func (s *smtpService) SendPasswordResetEmail(to, name, token string) error {
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", s.appURL, token)
	body := emailTemplate("Reset Password", fmt.Sprintf(`
		<p>Halo <strong>%s</strong>,</p>
		<p>Kami menerima permintaan reset password untuk akun FinTrackr kamu.</p>
		<p style="text-align:center; margin: 32px 0;">
			<a href="%s" style="background:#ef4444;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a>
		</p>
		<p>Link berlaku selama <strong>1 jam</strong>. Jika kamu tidak meminta reset password, abaikan email ini.</p>
		<p style="font-size:12px;color:#888;">Atau salin link berikut: <br><a href="%s">%s</a></p>
	`, name, resetURL, resetURL, resetURL))
	return s.send(to, "Reset Password FinTrackr", body)
}

func (s *smtpService) SendWelcomeEmail(to, name string) error {
	body := emailTemplate("Selamat Datang!", fmt.Sprintf(`
		<p>Halo <strong>%s</strong>,</p>
		<p>Selamat datang di FinTrackr! Akun kamu sudah aktif dan siap digunakan.</p>
		<p>Mulai kelola keuangan kamu dengan mudah:</p>
		<ul>
			<li>📊 Dashboard ringkasan keuangan bulanan</li>
			<li>💸 Catat pemasukan dan pengeluaran</li>
			<li>🏦 Kelola multiple rekening</li>
			<li>📉 Buat budget dan pantau progress</li>
		</ul>
		<p style="text-align:center; margin: 32px 0;">
			<a href="%s" style="background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Buka FinTrackr</a>
		</p>
	`, name, s.appURL))
	return s.send(to, "Selamat Datang di FinTrackr!", body)
}

func (s *smtpService) SendWorkspaceInviteEmail(to, inviterName, workspaceName, token string) error {
	acceptURL := fmt.Sprintf("%s/workspace/accept-invite?token=%s", s.appURL, token)
	body := emailTemplate("Undangan Workspace", fmt.Sprintf(`
		<p>Halo,</p>
		<p><strong>%s</strong> mengundang kamu untuk bergabung ke workspace <strong>%s</strong> di FinTrackr.</p>
		<p style="text-align:center; margin: 32px 0;">
			<a href="%s" style="background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Terima Undangan</a>
		</p>
		<p>Link berlaku selama <strong>7 hari</strong>. Jika kamu tidak mengenal pengirim, abaikan email ini.</p>
	`, inviterName, workspaceName, acceptURL))
	return s.send(to, fmt.Sprintf("Undangan Workspace %s - FinTrackr", workspaceName), body)
}

func emailTemplate(title, content string) string {
	return strings.TrimSpace(fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#6366f1;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">💰 FinTrackr</h1>
      <p style="color:#e0e7ff;margin:4px 0 0;font-size:14px;">%s</p>
    </div>
    <div style="padding:32px;color:#374151;line-height:1.6;">
      %s
    </div>
    <div style="padding:16px 32px;background:#f3f4f6;text-align:center;font-size:12px;color:#9ca3af;">
      FinTrackr · Self-Hosted Financial Tracker<br>
      Email ini dikirim otomatis, jangan dibalas.
    </div>
  </div>
</body>
</html>`, title, content))
}
