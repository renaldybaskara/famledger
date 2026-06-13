package payment

import (
	"crypto/sha512"
	"fmt"
	"testing"
)

func makeSignature(orderID, statusCode, grossAmount, serverKey string) string {
	h := sha512.New()
	h.Write([]byte(orderID + statusCode + grossAmount + serverKey))
	return fmt.Sprintf("%x", h.Sum(nil))
}

func TestVerifyNotification_Valid(t *testing.T) {
	svc := NewMidtransService("test-server-key", "test-client-key", false)
	sig := makeSignature("order-001", "200", "49000.00", "test-server-key")
	if !svc.VerifyNotification("order-001", "200", "49000.00", sig) {
		t.Error("expected valid signature to pass")
	}
}

func TestVerifyNotification_WrongKey(t *testing.T) {
	svc := NewMidtransService("real-server-key", "", false)
	sig := makeSignature("order-002", "200", "49000.00", "wrong-key")
	if svc.VerifyNotification("order-002", "200", "49000.00", sig) {
		t.Error("expected wrong server key to fail")
	}
}

func TestVerifyNotification_TamperedAmount(t *testing.T) {
	svc := NewMidtransService("test-server-key", "", false)
	sig := makeSignature("order-003", "200", "49000.00", "test-server-key")
	if svc.VerifyNotification("order-003", "200", "1.00", sig) {
		t.Error("expected tampered amount to fail")
	}
}

func TestVerifyNotification_EmptySignature(t *testing.T) {
	svc := NewMidtransService("test-server-key", "", false)
	if svc.VerifyNotification("order-004", "200", "49000.00", "") {
		t.Error("expected empty signature to fail")
	}
}

func TestEnabled(t *testing.T) {
	if !NewMidtransService("key", "", false).Enabled() {
		t.Error("expected Enabled()=true when serverKey set")
	}
	if NewMidtransService("", "", false).Enabled() {
		t.Error("expected Enabled()=false when serverKey empty")
	}
}

func TestSnapBaseURL(t *testing.T) {
	if got := NewMidtransService("k", "", false).snapBaseURL(); got != "https://app.sandbox.midtrans.com/snap/v1/transactions" {
		t.Errorf("unexpected sandbox URL: %s", got)
	}
	if got := NewMidtransService("k", "", true).snapBaseURL(); got != "https://app.midtrans.com/snap/v1/transactions" {
		t.Errorf("unexpected production URL: %s", got)
	}
}
