package repository

import (
	"context"
	"errors"
	"strings"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	"gorm.io/gorm"
)

type bankParserRuleRepository struct {
	db *gorm.DB
}

func NewBankParserRuleRepository(db *gorm.DB) domainrepo.BankParserRuleRepository {
	return &bankParserRuleRepository{db: db}
}

func (r *bankParserRuleRepository) FindAllActive(ctx context.Context) ([]entity.BankParserRule, error) {
	var rules []entity.BankParserRule
	err := r.db.WithContext(ctx).
		Where("is_active = true AND is_global = true").
		Order("priority ASC, id ASC").
		Find(&rules).Error
	return rules, err
}

func (r *bankParserRuleRepository) FindAll(ctx context.Context) ([]entity.BankParserRule, error) {
	var rules []entity.BankParserRule
	err := r.db.WithContext(ctx).
		Order("priority ASC, id ASC").
		Find(&rules).Error
	return rules, err
}

func (r *bankParserRuleRepository) FindByID(ctx context.Context, id uint) (*entity.BankParserRule, error) {
	var rule entity.BankParserRule
	err := r.db.WithContext(ctx).First(&rule, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &rule, nil
}

func (r *bankParserRuleRepository) FindByName(ctx context.Context, name string) (*entity.BankParserRule, error) {
	var rule entity.BankParserRule
	err := r.db.WithContext(ctx).
		Where("LOWER(name) = ?", strings.ToLower(name)).
		First(&rule).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &rule, nil
}

func (r *bankParserRuleRepository) Create(ctx context.Context, rule *entity.BankParserRule) error {
	return r.db.WithContext(ctx).Create(rule).Error
}

func (r *bankParserRuleRepository) Update(ctx context.Context, id uint, data map[string]interface{}) (*entity.BankParserRule, error) {
	err := r.db.WithContext(ctx).Model(&entity.BankParserRule{}).
		Where("id = ?", id).
		Updates(data).Error
	if err != nil {
		return nil, err
	}
	return r.FindByID(ctx, id)
}

func (r *bankParserRuleRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&entity.BankParserRule{}, id).Error
}
