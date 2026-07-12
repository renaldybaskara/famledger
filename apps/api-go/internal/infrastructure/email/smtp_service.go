package email

import (
	"crypto/tls"
	"fmt"
	"math/rand"
	"net/smtp"
	"strings"
	"time"
)

type EmailService interface {
	SendVerificationEmail(to, name, token string) error
	SendPasswordResetEmail(to, name, token string) error
	SendWelcomeEmail(to, name string) error
	SendWorkspaceInviteEmail(to, inviterName, workspaceName, token string) error
}

type smtpService struct {
	host    string
	port    string
	user    string
	pass    string
	from    string // full "Display Name <addr@domain>" or just "addr@domain"
	appURL  string
	enabled bool
}

func NewSMTPService(host, port, user, pass, from, appURL string) EmailService {
	// If no explicit From configured, fall back to bare email address
	if from == "" {
		from = user
	}
	return &smtpService{
		host:    host,
		port:    port,
		user:    user,
		pass:    pass,
		from:    from,
		appURL:  appURL,
		enabled: host != "" && user != "" && pass != "",
	}
}

// messageID generates a unique RFC 5322 Message-ID for each email.
// A proper Message-ID reduces spam score significantly.
func messageID(host string) string {
	if host == "" {
		host = "budgetin.app"
	}
	// Use timestamp + random number for uniqueness
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	return fmt.Sprintf("<%d.%d@%s>", time.Now().UnixNano(), r.Int63(), host)
}

// send builds a properly-headered RFC 5322 email and delivers it via SMTP.
// Headers included: From, To, Reply-To, Message-ID, Date, Subject, MIME.
// These are the minimum headers needed to avoid Gmail spam flagging.
func (s *smtpService) send(to, subject, body string) error {
	if !s.enabled {
		// Dev mode — print to stdout with clear prefix (captured by logger → app.log)
		fmt.Printf("[EMAIL] To: %s | Subject: %s\n%s\n---\n", to, subject, body)
		return nil
	}

	msgID := messageID(s.host)
	now := time.Now().Format(time.RFC1123Z)

	// Build RFC 5322 compliant headers.
	// Reply-To = same as From so replies go to the configured sender address,
	// not a dead noreply alias — this improves deliverability.
	headers := strings.Join([]string{
		fmt.Sprintf("From: %s", s.from),
		fmt.Sprintf("To: %s", to),
		fmt.Sprintf("Reply-To: %s", s.from),
		fmt.Sprintf("Message-ID: %s", msgID),
		fmt.Sprintf("Date: %s", now),
		fmt.Sprintf("Subject: %s", subject),
		"MIME-Version: 1.0",
		"Content-Type: text/html; charset=UTF-8",
		"", // blank line separates headers from body
	}, "\r\n")

	message := headers + body

	addr := fmt.Sprintf("%s:%s", s.host, s.port)

	// Extract bare email address from "Display Name <addr>" for SMTP envelope
	envelopeFrom := extractAddr(s.from)

	if s.port == "465" {
		// SSL — direct TLS connection
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
		if err := client.Mail(envelopeFrom); err != nil {
			return err
		}
		if err := client.Rcpt(to); err != nil {
			return err
		}
		w, err := client.Data()
		if err != nil {
			return err
		}
		if _, err = fmt.Fprint(w, message); err != nil {
			return err
		}
		return w.Close()
	}

	// STARTTLS — port 587 (Gmail default)
	auth := smtp.PlainAuth("", s.user, s.pass, s.host)
	return smtp.SendMail(addr, auth, envelopeFrom, []string{to}, []byte(message))
}

// extractAddr pulls the bare email address out of "Display Name <email@domain>"
// or returns the string as-is if it's already a plain address.
func extractAddr(from string) string {
	start := strings.LastIndex(from, "<")
	end := strings.LastIndex(from, ">")
	if start != -1 && end != -1 && end > start {
		return strings.TrimSpace(from[start+1 : end])
	}
	return strings.TrimSpace(from)
}

// ── Email templates ───────────────────────────────────────────────────────────

func (s *smtpService) SendVerificationEmail(to, name, token string) error {
	verifyURL := fmt.Sprintf("%s/verify-email?token=%s", s.appURL, token)
	body := emailTemplate(s.appURL, "Verifikasi Email Kamu", fmt.Sprintf(`
		<p>Halo <strong>%s</strong>,</p>
		<p>Terima kasih sudah mendaftar di Budgetin! Klik tombol di bawah untuk memverifikasi email kamu.</p>
		<p style="text-align:center; margin: 32px 0;">
			<a href="%s" style="background:#6B8E6B;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-family:Inter,system-ui,sans-serif;">Verifikasi Email</a>
		</p>
		<p>Link berlaku selama <strong>24 jam</strong>. Jika kamu tidak mendaftar, abaikan email ini.</p>
		<p style="font-size:12px;color:#888;">Atau salin link berikut: <br><a href="%s">%s</a></p>
	`, name, verifyURL, verifyURL, verifyURL))
	return s.send(to, "Verifikasi Email Budgetin", body)
}

func (s *smtpService) SendPasswordResetEmail(to, name, token string) error {
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", s.appURL, token)
	body := emailTemplate(s.appURL, "Reset Password", fmt.Sprintf(`
		<p>Halo <strong>%s</strong>,</p>
		<p>Kami menerima permintaan reset password untuk akun Budgetin kamu.</p>
		<p style="text-align:center; margin: 32px 0;">
			<a href="%s" style="background:#C66B6B;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-family:Inter,system-ui,sans-serif;">Reset Password</a>
		</p>
		<p>Link berlaku selama <strong>1 jam</strong>. Jika kamu tidak meminta reset password, abaikan email ini.</p>
		<p style="font-size:12px;color:#888;">Atau salin link berikut: <br><a href="%s">%s</a></p>
	`, name, resetURL, resetURL, resetURL))
	return s.send(to, "Reset Password Budgetin", body)
}

func (s *smtpService) SendWelcomeEmail(to, name string) error {
	body := emailTemplate(s.appURL, "Selamat Datang!", fmt.Sprintf(`
		<p>Halo <strong>%s</strong>,</p>
		<p>Selamat datang di Budgetin! Akun kamu sudah aktif dan siap digunakan.</p>
		<p>Mulai kelola keuangan keluargamu dengan mudah:</p>
		<ul>
			<li>📊 Dashboard ringkasan keuangan bulanan</li>
			<li>💸 Catat pemasukan dan pengeluaran</li>
			<li>🏦 Kelola multiple rekening</li>
			<li>📉 Buat budget dan pantau progress</li>
		</ul>
		<p style="text-align:center; margin: 32px 0;">
			<a href="%s" style="background:#6B8E6B;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-family:Inter,system-ui,sans-serif;">Buka Budgetin</a>
		</p>
	`, name, s.appURL))
	return s.send(to, "Selamat Datang di Budgetin! 🌿", body)
}

func (s *smtpService) SendWorkspaceInviteEmail(to, inviterName, workspaceName, token string) error {
	acceptURL := fmt.Sprintf("%s/workspace/accept-invite?token=%s", s.appURL, token)
	body := emailTemplate(s.appURL, "Undangan Workspace", fmt.Sprintf(`
		<p>Halo,</p>
		<p><strong>%s</strong> mengundang kamu untuk bergabung ke workspace <strong>%s</strong> di Budgetin.</p>
		<p style="text-align:center; margin: 32px 0;">
			<a href="%s" style="background:#6B8E6B;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-family:Inter,system-ui,sans-serif;">Terima Undangan</a>
		</p>
		<p>Link berlaku selama <strong>7 hari</strong>. Jika kamu tidak mengenal pengirim, abaikan email ini.</p>
		<p style="font-size:12px;color:#888;">Atau salin link berikut: <br><a href="%s">%s</a></p>
	`, inviterName, workspaceName, acceptURL, acceptURL, acceptURL))
	return s.send(to, fmt.Sprintf("Undangan Workspace %s - Budgetin 🌿", workspaceName), body)
}

// emailTemplate wraps content in the Budgetin branded HTML shell.
func emailTemplate(appURL, title, content string) string {
	return strings.TrimSpace(fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:'Inter','Segoe UI',system-ui,sans-serif;background:#FAF7F2;margin:0;padding:20px;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(45,42,38,0.08);">
    <!-- Header sage gradient -->
    <div style="background:linear-gradient(160deg,#6B8E6B 0%%,#41594F 100%%);padding:28px 32px;position:relative;overflow:hidden;">
      <!-- Decorative blob -->
      <div style="position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%%;background:#C97B5C;opacity:0.25;"></div>
      <div style="position:relative;">
        <div style="display:flex;align-items:center;gap:10px;">
          <img src="%s/logo.png" width="32" height="32" alt="logo" style="border-radius:8px;" />
          <span style="color:#ffffff;font-size:22px;font-weight:900;letter-spacing:-0.5px;">Budgetin.</span>
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
      Budgetin · Self-Hosted Family Finance Tracker 🌿<br>
      Email ini dikirim otomatis, jangan dibalas.
    </div>
  </div>
</body>
</html>`, appURL, title, content))
}
