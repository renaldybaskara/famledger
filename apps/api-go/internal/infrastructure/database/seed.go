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
		{ID: uuid.New(), Name: "Gaji", NameEn: strPtr("Salary"), Icon: "briefcase", Color: "#22C55E", Type: "income", IsDefault: true, IsActive: true, SortOrder: 1},
		{ID: uuid.New(), Name: "Freelance", NameEn: strPtr("Freelance"), Icon: "laptop", Color: "#16A34A", Type: "income", IsDefault: true, IsActive: true, SortOrder: 2},
		{ID: uuid.New(), Name: "Investasi", NameEn: strPtr("Investment"), Icon: "trending-up", Color: "#15803D", Type: "income", IsDefault: true, IsActive: true, SortOrder: 3},
		{ID: uuid.New(), Name: "Bonus", NameEn: strPtr("Bonus"), Icon: "gift", Color: "#4ADE80", Type: "income", IsDefault: true, IsActive: true, SortOrder: 4},
		{ID: uuid.New(), Name: "Lainnya", NameEn: strPtr("Other Income"), Icon: "plus-circle", Color: "#86EFAC", Type: "income", IsDefault: true, IsActive: true, SortOrder: 5},

		// Expense
		{ID: uuid.New(), Name: "Makanan & Minuman", NameEn: strPtr("Food & Drink"), Icon: "utensils", Color: "#EF4444", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 1},
		{ID: uuid.New(), Name: "Transportasi", NameEn: strPtr("Transportation"), Icon: "car", Color: "#F97316", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 2},
		{ID: uuid.New(), Name: "Belanja", NameEn: strPtr("Shopping"), Icon: "shopping-bag", Color: "#EAB308", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 3},
		{ID: uuid.New(), Name: "Tagihan & Utilitas", NameEn: strPtr("Bills & Utilities"), Icon: "zap", Color: "#8B5CF6", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 4},
		{ID: uuid.New(), Name: "Kesehatan", NameEn: strPtr("Health"), Icon: "heart", Color: "#EC4899", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 5},
		{ID: uuid.New(), Name: "Hiburan", NameEn: strPtr("Entertainment"), Icon: "film", Color: "#06B6D4", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 6},
		{ID: uuid.New(), Name: "Pendidikan", NameEn: strPtr("Education"), Icon: "book", Color: "#3B82F6", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 7},
		{ID: uuid.New(), Name: "Perumahan", NameEn: strPtr("Housing"), Icon: "home", Color: "#6366F1", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 8},
		{ID: uuid.New(), Name: "Pakaian", NameEn: strPtr("Clothing"), Icon: "shirt", Color: "#F43F5E", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 9},
		{ID: uuid.New(), Name: "Olahraga", NameEn: strPtr("Sports"), Icon: "activity", Color: "#10B981", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 10},
		{ID: uuid.New(), Name: "Perawatan Diri", NameEn: strPtr("Self Care"), Icon: "smile", Color: "#F472B6", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 11},
		{ID: uuid.New(), Name: "Lainnya", NameEn: strPtr("Other Expense"), Icon: "more-horizontal", Color: "#9CA3AF", Type: "expense", IsDefault: true, IsActive: true, SortOrder: 12},

		// Transfer
		{ID: uuid.New(), Name: "Transfer", NameEn: strPtr("Transfer"), Icon: "refresh-cw", Color: "#64748B", Type: "transfer", IsDefault: true, IsActive: true, SortOrder: 1},
		{ID: uuid.New(), Name: "Tabungan", NameEn: strPtr("Savings"), Icon: "piggy-bank", Color: "#0EA5E9", Type: "transfer", IsDefault: true, IsActive: true, SortOrder: 2},
		{ID: uuid.New(), Name: "Investasi", NameEn: strPtr("Investment Transfer"), Icon: "bar-chart-2", Color: "#7C3AED", Type: "transfer", IsDefault: true, IsActive: true, SortOrder: 3},
		{ID: uuid.New(), Name: "Lainnya", NameEn: strPtr("Other Transfer"), Icon: "arrow-right-left", Color: "#94A3B8", Type: "transfer", IsDefault: true, IsActive: true, SortOrder: 4},
	}

	return db.CreateInBatches(categories, 10).Error
}

func strPtr(s string) *string {
	return &s
}
