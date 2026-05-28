package usecase

import (
	"context"
	"errors"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	"github.com/google/uuid"
)

type accountUseCase struct {
	repo domainrepo.AccountRepository
}

func NewAccountUseCase(repo domainrepo.AccountRepository) domainuc.AccountUseCase {
	return &accountUseCase{repo: repo}
}

func (uc *accountUseCase) FindAll(ctx context.Context, userID uuid.UUID) ([]entity.Account, error) {
	return uc.repo.FindAllByUserID(ctx, userID)
}

func (uc *accountUseCase) Create(ctx context.Context, userID uuid.UUID, in domainuc.CreateAccountInput) (*entity.Account, error) {
	account := &entity.Account{
		ID:     uuid.New(),
		UserID: userID,
		Name:   in.Name,
		Type:   in.Type,
	}
	if in.BankCode != nil {
		account.BankCode = in.BankCode
	}
	if in.AccountNumber != nil {
		account.AccountNumber = in.AccountNumber
	}
	if in.Balance != nil {
		account.Balance = *in.Balance
	}
	if in.Currency != nil {
		account.Currency = *in.Currency
	}
	if in.Color != nil {
		account.Color = *in.Color
	} else {
		account.Color = "#1A2B4A"
	}
	if in.Icon != nil {
		account.Icon = *in.Icon
	} else {
		account.Icon = "wallet"
	}

	if err := uc.repo.Create(ctx, account); err != nil {
		return nil, err
	}
	return account, nil
}

func (uc *accountUseCase) Update(ctx context.Context, userID, id uuid.UUID, in domainuc.UpdateAccountInput) (*entity.Account, error) {
	existing, err := uc.repo.FindByID(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, errors.New("account not found")
	}

	data := make(map[string]interface{})
	if in.Name != nil {
		data["name"] = *in.Name
	}
	if in.Type != nil {
		data["type"] = *in.Type
	}
	if in.BankCode != nil {
		data["bank_code"] = *in.BankCode
	}
	if in.AccountNumber != nil {
		data["account_number"] = *in.AccountNumber
	}
	if in.Color != nil {
		data["color"] = *in.Color
	}
	if in.Icon != nil {
		data["icon"] = *in.Icon
	}
	if in.IsDefault != nil {
		data["is_default"] = *in.IsDefault
	}

	return uc.repo.Update(ctx, userID, id, data)
}

func (uc *accountUseCase) Delete(ctx context.Context, userID, id uuid.UUID) error {
	existing, err := uc.repo.FindByID(ctx, userID, id)
	if err != nil {
		return err
	}
	if existing == nil {
		return errors.New("account not found")
	}
	return uc.repo.SoftDelete(ctx, userID, id)
}
