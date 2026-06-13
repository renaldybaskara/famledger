package database

import (
	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SeedDefaultCategories inserts default categories if none exist
func SeedDefaultCategories(db *gorm.DB) error {
	var count int64
	db.Model(&entity.Category{}).Where("user_id IS NULL AND is_default = true").Count(&count)
	if count > 0 {
		return nil // Already seeded
	}

	categories := []entity.Category{
		// Income
		{ID: uuid.New(), Name: "Gaji", NameEn: strPtr("Salary"), Icon: "💼", Color: "#6B8E6B", Type: "income", IsDefault: true, IsActive: true, SortOrder: 1},
		{ID: uuid.New(), Name: "Freelance", NameEn: strPtr("Freelance"), Icon: "💻", Color: "#41594F", Type: "income", IsDefault: true, IsActive: true, SortOrder: 2},
		{ID: uuid.New(), Name: "Investasi", NameEn: strPtr("Investment"), Icon: "📈", Color: "#6B8E6B", Type: "income", IsDefault: true, IsActive: true, SortOrder: 3},
		{ID: uuid.New(), Name: "Bonus", NameEn: strPtr("Bonus"), Icon: "🎁", Color: "#D9A441", Type: "income", IsDefault: true, IsActive: true, SortOrder: 4},
		{ID: uuid.New(), Name: "Lainnya", NameEn: strPtr("Other Income"), Icon: "➕", Color: "#A8A39B", Type: "income", IsDefault: true, IsActive: true, SortOrder: 5},

		// Expense
		{ID: uuid.New(), Name: "Makanan & Minuman", NameEn: strPtr("Food & Drink"), Icon: "🍽️", Color: "#C97B5C", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 1},
		{ID: uuid.New(), Name: "Transportasi", NameEn: strPtr("Transportation"), Icon: "🚗", Color: "#D9A441", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 2},
		{ID: uuid.New(), Name: "Belanja", NameEn: strPtr("Shopping"), Icon: "🛒", Color: "#A8624A", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 3},
		{ID: uuid.New(), Name: "Tagihan & Utilitas", NameEn: strPtr("Bills & Utilities"), Icon: "⚡", Color: "#7E4F94", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 4},
		{ID: uuid.New(), Name: "Kesehatan", NameEn: strPtr("Health"), Icon: "❤️", Color: "#C66B6B", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 5},
		{ID: uuid.New(), Name: "Hiburan", NameEn: strPtr("Entertainment"), Icon: "🎬", Color: "#6E97AE", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 6},
		{ID: uuid.New(), Name: "Pendidikan", NameEn: strPtr("Education"), Icon: "📚", Color: "#6E97AE", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 7},
		{ID: uuid.New(), Name: "Perumahan", NameEn: strPtr("Housing"), Icon: "🏠", Color: "#6B8E6B", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 8},
		{ID: uuid.New(), Name: "Pakaian", NameEn: strPtr("Clothing"), Icon: "👕", Color: "#C97B5C", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 9},
		{ID: uuid.New(), Name: "Olahraga", NameEn: strPtr("Sports"), Icon: "🏋️", Color: "#6B8E6B", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 10},
		{ID: uuid.New(), Name: "Perawatan Diri", NameEn: strPtr("Self Care"), Icon: "😊", Color: "#C97B5C", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 11},
		{ID: uuid.New(), Name: "Lainnya", NameEn: strPtr("Other Expense"), Icon: "•••", Color: "#A8A39B", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 12},

		// Transfer
		{ID: uuid.New(), Name: "Transfer", NameEn: strPtr("Transfer"), Icon: "🔄", Color: "#6E97AE", Type: "transfer", IsDefault: true, IsActive: true, SortOrder: 1},
		{ID: uuid.New(), Name: "Tabungan", NameEn: strPtr("Savings"), Icon: "🐷", Color: "#6B8E6B", Type: "transfer", IsDefault: true, IsActive: true, SortOrder: 2},
		{ID: uuid.New(), Name: "Investasi", NameEn: strPtr("Investment Transfer"), Icon: "📊", Color: "#7E4F94", Type: "transfer", IsDefault: true, IsActive: true, SortOrder: 3},
		{ID: uuid.New(), Name: "Lainnya", NameEn: strPtr("Other Transfer"), Icon: "↔️", Color: "#A8A39B", Type: "transfer", IsDefault: true, IsActive: true, SortOrder: 4},
	}

	return db.CreateInBatches(categories, 10).Error
}

func strPtr(s string) *string {
	return &s
}
