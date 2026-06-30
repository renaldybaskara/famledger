package handler

import (
	"io"
	"net/http"
	"strings"

	httputil "github.com/fintrackr/api/internal/delivery/http/httputil"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const maxSlipImageSize = 10 << 20 // 10 MB

// heicBrands are the ISO Base Media File Format major brands used by HEIC/HEIF.
// HEIC/HEIF files start with a 4-byte box size, then "ftyp", then a 4-byte brand.
var heicBrands = map[string]struct{}{
	"heic": {}, "heis": {}, "hevx": {}, "heim": {},
	"hevc": {}, "hevs": {}, "mif1": {}, "msf1": {},
}

// isHEICBytes returns true when the byte slice is a HEIC/HEIF image.
func isHEICBytes(b []byte) bool {
	if len(b) < 12 {
		return false
	}
	if string(b[4:8]) != "ftyp" {
		return false
	}
	brand := string(b[8:12])
	_, ok := heicBrands[brand]
	return ok
}

// PaymentSlipHandler handles payment slip OCR requests.
type PaymentSlipHandler struct {
	uc domainuc.PaymentSlipUseCase
}

func NewPaymentSlipHandler(uc domainuc.PaymentSlipUseCase) *PaymentSlipHandler {
	return &PaymentSlipHandler{uc: uc}
}

// Scan accepts a multipart image upload, runs OCR, and returns parsed financial fields.
// POST /api/payment-slips/scan
func (h *PaymentSlipHandler) Scan(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)

	// Enforce size limit at the reader level before buffering
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxSlipImageSize)

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		httputil.BadRequest(c, "Field 'file' wajib diisi (multipart/form-data)")
		return
	}
	defer file.Close()

	imageBytes, err := io.ReadAll(file)
	if err != nil {
		// MaxBytesReader returns an error when limit exceeded
		if strings.Contains(err.Error(), "too large") || strings.Contains(err.Error(), "request body too large") {
			httputil.BadRequest(c, "Ukuran gambar melebihi batas (maks 10 MB)")
		} else {
			httputil.InternalError(c, err)
		}
		return
	}

	// Detect MIME type — prefer magic bytes over header (iOS quirks)
	// http.DetectContentType does not recognise HEIC/HEIF, so we check manually.
	detectedMIME := http.DetectContentType(imageBytes)
	clientMIME := strings.ToLower(strings.SplitN(header.Header.Get("Content-Type"), ";", 2)[0])

	isImageMIME := strings.HasPrefix(detectedMIME, "image/") ||
		strings.HasPrefix(clientMIME, "image/")
	isHEIC := isHEICBytes(imageBytes)

	if !isImageMIME && !isHEIC {
		httputil.BadRequest(c, "File harus berupa gambar (JPEG, PNG, WebP, atau HEIC)")
		return
	}

	filename := header.Filename
	if filename == "" {
		filename = "slip.jpg"
	}

	result, err := h.uc.ScanSlip(c.Request.Context(), domainuc.ScanSlipInput{
		ImageBytes: imageBytes,
		Filename:   filename,
		UserID:     userID,
	})
	if err != nil {
		switch err {
		case domainuc.ErrOCRServiceUnavailable:
			httputil.InternalError(c, err)
		case domainuc.ErrImageTooLarge:
			httputil.BadRequest(c, "Ukuran gambar melebihi batas (maks 10 MB)")
		default:
			httputil.InternalError(c, err)
		}
		return
	}

	httputil.OK(c, result)
}
