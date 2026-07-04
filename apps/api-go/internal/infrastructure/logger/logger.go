// Package logger provides three named loggers that write to both stdout
// and separate log files mounted at /app/logs inside the container.
//
// Log files:
//
//	app.log    — startup, database, auth, SMTP, general errors
//	worker.log — Gmail worker polls, email import pipeline, AI calls
//	http.log   — Gin HTTP access log (every request/response)
//
// All three loggers also write to stdout so `docker logs` still works normally.
// If the log directory cannot be opened (e.g. mount missing), the loggers fall
// back to stdout-only and a warning is printed — the app never crashes on logging.
package logger

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
)

// App is used for startup events, database, auth, SMTP, and general errors.
var App *log.Logger

// Worker is used for Gmail worker polls, email import results, and AI calls.
var Worker *log.Logger

// HTTP is used for the Gin access log (wired via gin.LoggerWithWriter).
var HTTP *log.Logger

// Init initialises all three loggers. logDir should be "/app/logs" in production
// and can be any writable path in tests/local dev (or "" to use stdout-only).
//
// Returns a cleanup func that closes all open log files — call it via defer in main.
func Init(logDir string) func() {
	appWriter := openLogFile(logDir, "app.log")
	workerWriter := openLogFile(logDir, "worker.log")
	httpWriter := openLogFile(logDir, "http.log")

	// Each logger writes to file AND stdout simultaneously.
	flags := log.LstdFlags // e.g. "2009/11/10 23:00:00"

	App = log.New(io.MultiWriter(os.Stdout, appWriter.w), "", flags)
	Worker = log.New(io.MultiWriter(os.Stdout, workerWriter.w), "", flags)
	HTTP = log.New(io.MultiWriter(os.Stdout, httpWriter.w), "", flags)

	// Redirect the global log package (log.Printf / log.Println / log.Fatal) to app.log
	// so any third-party code or pre-Init calls land in the right file.
	log.SetOutput(io.MultiWriter(os.Stdout, appWriter.w))
	log.SetFlags(flags)

	return func() {
		appWriter.close()
		workerWriter.close()
		httpWriter.close()
	}
}

// logFile wraps an *os.File so we can no-op Close on stdout fallback.
type logFile struct {
	w    io.Writer
	file *os.File // nil when falling back to stdout
}

func (l *logFile) close() {
	if l.file != nil {
		_ = l.file.Close()
	}
}

// openLogFile opens (or creates) a log file inside logDir.
// If logDir is empty or the file cannot be opened, it falls back to io.Discard
// for the file portion (stdout is always retained via MultiWriter in Init).
func openLogFile(logDir, name string) *logFile {
	if logDir == "" {
		// No directory configured — stdout only (file portion discarded).
		return &logFile{w: io.Discard}
	}

	// Ensure the directory exists (useful for local dev without Docker volume).
	if err := os.MkdirAll(logDir, 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "[logger] cannot create log dir %q: %v — using stdout only for %s\n", logDir, err, name)
		return &logFile{w: io.Discard}
	}

	path := filepath.Join(logDir, name)
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[logger] cannot open %q: %v — using stdout only\n", path, err)
		return &logFile{w: io.Discard}
	}

	return &logFile{w: f, file: f}
}
