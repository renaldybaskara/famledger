package usecase

import (
	"errors"
	"testing"

	"github.com/fintrackr/api/internal/domain/entity"
	domainRepo "github.com/fintrackr/api/internal/domain/repository"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// --- Mock Repository ---

type MockSavingsGoalRepository struct {
	mock.Mock
}

func (m *MockSavingsGoalRepository) Create(goal *entity.SavingsGoal) error {
	args := m.Called(goal)
	return args.Error(0)
}

func (m *MockSavingsGoalRepository) FindByID(id uuid.UUID) (*entity.SavingsGoal, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*entity.SavingsGoal), args.Error(1)
}

func (m *MockSavingsGoalRepository) FindByUserID(userID uuid.UUID, status string) ([]entity.SavingsGoal, error) {
	args := m.Called(userID, status)
	return args.Get(0).([]entity.SavingsGoal), args.Error(1)
}

func (m *MockSavingsGoalRepository) FindByWorkspaceID(workspaceID uuid.UUID, status string) ([]entity.SavingsGoal, error) {
	args := m.Called(workspaceID, status)
	return args.Get(0).([]entity.SavingsGoal), args.Error(1)
}

func (m *MockSavingsGoalRepository) Update(goal *entity.SavingsGoal) error {
	args := m.Called(goal)
	return args.Error(0)
}

func (m *MockSavingsGoalRepository) Delete(id uuid.UUID) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockSavingsGoalRepository) UpdateStatus(id uuid.UUID, status string) error {
	args := m.Called(id, status)
	return args.Error(0)
}

func (m *MockSavingsGoalRepository) UpdateCurrentAmount(id uuid.UUID, amount float64) error {
	args := m.Called(id, amount)
	return args.Error(0)
}

func (m *MockSavingsGoalRepository) CreateSource(source *entity.SavingsGoalSource) error {
	args := m.Called(source)
	return args.Error(0)
}

func (m *MockSavingsGoalRepository) FindSourcesByGoalID(goalID uuid.UUID) ([]entity.SavingsGoalSource, error) {
	args := m.Called(goalID)
	return args.Get(0).([]entity.SavingsGoalSource), args.Error(1)
}

func (m *MockSavingsGoalRepository) FindSourceByID(id uuid.UUID) (*entity.SavingsGoalSource, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*entity.SavingsGoalSource), args.Error(1)
}

func (m *MockSavingsGoalRepository) UpdateSource(source *entity.SavingsGoalSource) error {
	args := m.Called(source)
	return args.Error(0)
}

func (m *MockSavingsGoalRepository) DeleteSource(id uuid.UUID) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockSavingsGoalRepository) FindAutoSourcesByAccountID(accountID uuid.UUID) ([]entity.SavingsGoalSource, error) {
	args := m.Called(accountID)
	return args.Get(0).([]entity.SavingsGoalSource), args.Error(1)
}

func (m *MockSavingsGoalRepository) CreateContribution(contribution *entity.SavingsGoalContribution) error {
	args := m.Called(contribution)
	return args.Error(0)
}

func (m *MockSavingsGoalRepository) FindContributionsByGoalID(goalID uuid.UUID, contribType string, page, limit int) ([]entity.SavingsGoalContribution, int64, error) {
	args := m.Called(goalID, contribType, page, limit)
	return args.Get(0).([]entity.SavingsGoalContribution), args.Get(1).(int64), args.Error(2)
}

func (m *MockSavingsGoalRepository) FindContributionByTransactionID(transactionID uuid.UUID) (*entity.SavingsGoalContribution, error) {
	args := m.Called(transactionID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*entity.SavingsGoalContribution), args.Error(1)
}

func (m *MockSavingsGoalRepository) FindAllocationsByAccountID(accountID uuid.UUID) ([]entity.SavingsGoalAllocation, error) {
	args := m.Called(accountID)
	return args.Get(0).([]entity.SavingsGoalAllocation), args.Error(1)
}

func (m *MockSavingsGoalRepository) FindAllocationsByGoalID(goalID uuid.UUID) ([]entity.SavingsGoalAllocation, error) {
	args := m.Called(goalID)
	return args.Get(0).([]entity.SavingsGoalAllocation), args.Error(1)
}

func (m *MockSavingsGoalRepository) UpsertAllocations(allocations []entity.SavingsGoalAllocation) error {
	args := m.Called(allocations)
	return args.Error(0)
}

func (m *MockSavingsGoalRepository) GetSummary(userID uuid.UUID) (*domainRepo.SavingsGoalSummary, error) {
	args := m.Called(userID)
	return args.Get(0).(*domainRepo.SavingsGoalSummary), args.Error(1)
}

func (m *MockSavingsGoalRepository) CountActiveGoals(userID uuid.UUID) (int64, error) {
	args := m.Called(userID)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockSavingsGoalRepository) CountActiveWorkspaceGoals(workspaceID uuid.UUID) (int64, error) {
	args := m.Called(workspaceID)
	return args.Get(0).(int64), args.Error(1)
}

// --- Tests ---

func TestCreateGoal_Success(t *testing.T) {
	mockRepo := new(MockSavingsGoalRepository)
	uc := NewSavingsGoalUsecase(mockRepo)

	userID := uuid.New()
	goalID := uuid.New()

	mockRepo.On("CountActiveGoals", userID).Return(int64(5), nil)
	mockRepo.On("Create", mock.AnythingOfType("*entity.SavingsGoal")).Return(nil).Run(func(args mock.Arguments) {
		goal := args.Get(0).(*entity.SavingsGoal)
		goal.ID = goalID
	})
	mockRepo.On("FindByID", goalID).Return(&entity.SavingsGoal{
		ID:           goalID,
		UserID:       userID,
		Name:         "DP Rumah",
		TargetAmount: 200000000,
		Status:       "active",
	}, nil)

	input := CreateGoalInput{
		UserID:       userID,
		Name:         "DP Rumah",
		TargetAmount: 200000000,
	}

	goal, err := uc.CreateGoal(input)
	assert.NoError(t, err)
	assert.NotNil(t, goal)
	assert.Equal(t, "DP Rumah", goal.Name)
	assert.Equal(t, float64(200000000), goal.TargetAmount)
	assert.Equal(t, "active", goal.Status)
}

func TestCreateGoal_MaxLimitReached(t *testing.T) {
	mockRepo := new(MockSavingsGoalRepository)
	uc := NewSavingsGoalUsecase(mockRepo)

	userID := uuid.New()
	mockRepo.On("CountActiveGoals", userID).Return(int64(20), nil)

	input := CreateGoalInput{
		UserID:       userID,
		Name:         "Goal 21",
		TargetAmount: 50000000,
	}

	goal, err := uc.CreateGoal(input)
	assert.Error(t, err)
	assert.Nil(t, goal)
	assert.Contains(t, err.Error(), "maximum 20 active goals")
}

func TestCreateGoal_MinimumAmount(t *testing.T) {
	mockRepo := new(MockSavingsGoalRepository)
	uc := NewSavingsGoalUsecase(mockRepo)

	userID := uuid.New()
	mockRepo.On("CountActiveGoals", userID).Return(int64(0), nil)

	input := CreateGoalInput{
		UserID:       userID,
		Name:         "Too Small",
		TargetAmount: 5000, // below 10000 minimum
	}

	goal, err := uc.CreateGoal(input)
	assert.Error(t, err)
	assert.Nil(t, goal)
	assert.Contains(t, err.Error(), "minimum Rp 10.000")
}

func TestUpdateGoalStatus_ValidTransitions(t *testing.T) {
	mockRepo := new(MockSavingsGoalRepository)
	uc := NewSavingsGoalUsecase(mockRepo)

	goalID := uuid.New()
	userID := uuid.New()

	// active → paused (valid)
	mockRepo.On("FindByID", goalID).Return(&entity.SavingsGoal{
		ID:     goalID,
		UserID: userID,
		Status: "active",
	}, nil)
	mockRepo.On("UpdateStatus", goalID, "paused").Return(nil)

	err := uc.UpdateGoalStatus(goalID, userID, "paused")
	assert.NoError(t, err)
}

func TestUpdateGoalStatus_InvalidTransition(t *testing.T) {
	mockRepo := new(MockSavingsGoalRepository)
	uc := NewSavingsGoalUsecase(mockRepo)

	goalID := uuid.New()
	userID := uuid.New()

	// paused → cancelled (invalid — paused can only go to active)
	mockRepo.On("FindByID", goalID).Return(&entity.SavingsGoal{
		ID:     goalID,
		UserID: userID,
		Status: "paused",
	}, nil)

	err := uc.UpdateGoalStatus(goalID, userID, "cancelled")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid status transition")
}

func TestProcessIncomingTransaction_SingleGoal_FullAmount(t *testing.T) {
	mockRepo := new(MockSavingsGoalRepository)
	uc := NewSavingsGoalUsecase(mockRepo)

	accountID := uuid.New()
	goalID := uuid.New()
	sourceID := uuid.New()
	txID := uuid.New()
	userID := uuid.New()

	tx := entity.Transaction{
		ID:        txID,
		AccountID: &accountID,
		Type:      "income",
		Amount:    5000000,
	}

	// Find auto sources for this account
	mockRepo.On("FindAutoSourcesByAccountID", accountID).Return([]entity.SavingsGoalSource{
		{
			ID:           sourceID,
			GoalID:       goalID,
			SourceType:   "saving_account",
			TrackingMode: "auto",
			AccountID:    &accountID,
			Goal: &entity.SavingsGoal{
				ID:            goalID,
				UserID:        userID,
				Status:        "active",
				TargetAmount:  200000000,
				CurrentAmount: 100000000,
			},
		},
	}, nil)

	// Anti-double check — no existing contribution
	mockRepo.On("FindContributionByTransactionID", txID).Return(nil, errors.New("not found"))

	// No allocations
	mockRepo.On("FindAllocationsByAccountID", accountID).Return([]entity.SavingsGoalAllocation{}, nil)

	// Create contribution
	mockRepo.On("CreateContribution", mock.AnythingOfType("*entity.SavingsGoalContribution")).Return(nil)

	// Update amounts
	mockRepo.On("UpdateCurrentAmount", goalID, float64(5000000)).Return(nil)
	mockRepo.On("UpdateSource", mock.AnythingOfType("*entity.SavingsGoalSource")).Return(nil)

	// Check if achieved (100M + 5M = 105M, target 200M, not achieved)
	mockRepo.On("FindByID", goalID).Return(&entity.SavingsGoal{
		ID:            goalID,
		UserID:        userID,
		Status:        "active",
		TargetAmount:  200000000,
		CurrentAmount: 105000000,
	}, nil)

	err := uc.ProcessIncomingTransaction(tx)
	assert.NoError(t, err)

	// Verify contribution was created with full amount (single goal = 100%)
	mockRepo.AssertCalled(t, "CreateContribution", mock.MatchedBy(func(c *entity.SavingsGoalContribution) bool {
		return c.Amount == 5000000 && c.Type == "auto" && c.GoalID == goalID && *c.TransactionID == txID
	}))
}

func TestProcessIncomingTransaction_MultipleGoals_EqualSplit(t *testing.T) {
	mockRepo := new(MockSavingsGoalRepository)
	uc := NewSavingsGoalUsecase(mockRepo)

	accountID := uuid.New()
	goalID1 := uuid.New()
	goalID2 := uuid.New()
	sourceID1 := uuid.New()
	sourceID2 := uuid.New()
	txID := uuid.New()
	userID := uuid.New()

	tx := entity.Transaction{
		ID:        txID,
		AccountID: &accountID,
		Type:      "income",
		Amount:    10000000,
	}

	// Two goals linked to same account
	mockRepo.On("FindAutoSourcesByAccountID", accountID).Return([]entity.SavingsGoalSource{
		{
			ID:           sourceID1,
			GoalID:       goalID1,
			SourceType:   "saving_account",
			TrackingMode: "auto",
			AccountID:    &accountID,
			Goal: &entity.SavingsGoal{
				ID:            goalID1,
				UserID:        userID,
				Status:        "active",
				TargetAmount:  100000000,
				CurrentAmount: 50000000,
			},
		},
		{
			ID:           sourceID2,
			GoalID:       goalID2,
			SourceType:   "saving_account",
			TrackingMode: "auto",
			AccountID:    &accountID,
			Goal: &entity.SavingsGoal{
				ID:            goalID2,
				UserID:        userID,
				Status:        "active",
				TargetAmount:  50000000,
				CurrentAmount: 20000000,
			},
		},
	}, nil)

	// Anti-double check
	mockRepo.On("FindContributionByTransactionID", txID).Return(nil, errors.New("not found"))

	// No allocations — should split equally
	mockRepo.On("FindAllocationsByAccountID", accountID).Return([]entity.SavingsGoalAllocation{}, nil)

	// Create contributions for both goals
	mockRepo.On("CreateContribution", mock.AnythingOfType("*entity.SavingsGoalContribution")).Return(nil)
	mockRepo.On("UpdateCurrentAmount", mock.AnythingOfType("uuid.UUID"), mock.AnythingOfType("float64")).Return(nil)
	mockRepo.On("UpdateSource", mock.AnythingOfType("*entity.SavingsGoalSource")).Return(nil)

	// Check if achieved — neither achieved
	mockRepo.On("FindByID", goalID1).Return(&entity.SavingsGoal{
		ID: goalID1, UserID: userID, Status: "active", TargetAmount: 100000000, CurrentAmount: 55000000,
	}, nil)
	mockRepo.On("FindByID", goalID2).Return(&entity.SavingsGoal{
		ID: goalID2, UserID: userID, Status: "active", TargetAmount: 50000000, CurrentAmount: 25000000,
	}, nil)

	err := uc.ProcessIncomingTransaction(tx)
	assert.NoError(t, err)

	// Verify each goal got 50% (5M each from 10M income)
	mockRepo.AssertCalled(t, "UpdateCurrentAmount", goalID1, float64(5000000))
	mockRepo.AssertCalled(t, "UpdateCurrentAmount", goalID2, float64(5000000))
}

func TestProcessIncomingTransaction_MultipleGoals_WithAllocation(t *testing.T) {
	mockRepo := new(MockSavingsGoalRepository)
	uc := NewSavingsGoalUsecase(mockRepo)

	accountID := uuid.New()
	goalID1 := uuid.New()
	goalID2 := uuid.New()
	sourceID1 := uuid.New()
	sourceID2 := uuid.New()
	txID := uuid.New()
	userID := uuid.New()

	tx := entity.Transaction{
		ID:        txID,
		AccountID: &accountID,
		Type:      "income",
		Amount:    10000000,
	}

	mockRepo.On("FindAutoSourcesByAccountID", accountID).Return([]entity.SavingsGoalSource{
		{
			ID: sourceID1, GoalID: goalID1, SourceType: "saving_account", TrackingMode: "auto", AccountID: &accountID,
			Goal: &entity.SavingsGoal{ID: goalID1, UserID: userID, Status: "active", TargetAmount: 100000000, CurrentAmount: 50000000},
		},
		{
			ID: sourceID2, GoalID: goalID2, SourceType: "saving_account", TrackingMode: "auto", AccountID: &accountID,
			Goal: &entity.SavingsGoal{ID: goalID2, UserID: userID, Status: "active", TargetAmount: 50000000, CurrentAmount: 20000000},
		},
	}, nil)

	mockRepo.On("FindContributionByTransactionID", txID).Return(nil, errors.New("not found"))

	// Allocation: 70% to goal1, 30% to goal2
	mockRepo.On("FindAllocationsByAccountID", accountID).Return([]entity.SavingsGoalAllocation{
		{AccountID: accountID, GoalID: goalID1, SourceID: sourceID1, Percentage: 70},
		{AccountID: accountID, GoalID: goalID2, SourceID: sourceID2, Percentage: 30},
	}, nil)

	mockRepo.On("CreateContribution", mock.AnythingOfType("*entity.SavingsGoalContribution")).Return(nil)
	mockRepo.On("UpdateCurrentAmount", mock.AnythingOfType("uuid.UUID"), mock.AnythingOfType("float64")).Return(nil)
	mockRepo.On("UpdateSource", mock.AnythingOfType("*entity.SavingsGoalSource")).Return(nil)

	mockRepo.On("FindByID", goalID1).Return(&entity.SavingsGoal{
		ID: goalID1, UserID: userID, Status: "active", TargetAmount: 100000000, CurrentAmount: 57000000,
	}, nil)
	mockRepo.On("FindByID", goalID2).Return(&entity.SavingsGoal{
		ID: goalID2, UserID: userID, Status: "active", TargetAmount: 50000000, CurrentAmount: 23000000,
	}, nil)

	err := uc.ProcessIncomingTransaction(tx)
	assert.NoError(t, err)

	// Goal1 gets 70% = 7M, Goal2 gets 30% = 3M
	mockRepo.AssertCalled(t, "UpdateCurrentAmount", goalID1, float64(7000000))
	mockRepo.AssertCalled(t, "UpdateCurrentAmount", goalID2, float64(3000000))
}

func TestProcessIncomingTransaction_AntiDoubleCount(t *testing.T) {
	mockRepo := new(MockSavingsGoalRepository)
	uc := NewSavingsGoalUsecase(mockRepo)

	accountID := uuid.New()
	txID := uuid.New()

	tx := entity.Transaction{
		ID:        txID,
		AccountID: &accountID,
		Type:      "income",
		Amount:    5000000,
	}

	goalID := uuid.New()
	sourceID := uuid.New()
	userID := uuid.New()

	mockRepo.On("FindAutoSourcesByAccountID", accountID).Return([]entity.SavingsGoalSource{
		{
			ID: sourceID, GoalID: goalID, SourceType: "saving_account", TrackingMode: "auto", AccountID: &accountID,
			Goal: &entity.SavingsGoal{ID: goalID, UserID: userID, Status: "active", TargetAmount: 100000000, CurrentAmount: 50000000},
		},
	}, nil)

	// Already processed! Return existing contribution
	mockRepo.On("FindContributionByTransactionID", txID).Return(&entity.SavingsGoalContribution{
		ID:     uuid.New(),
		GoalID: goalID,
		Amount: 5000000,
	}, nil)

	err := uc.ProcessIncomingTransaction(tx)
	assert.NoError(t, err)

	// Should NOT call CreateContribution (already processed)
	mockRepo.AssertNotCalled(t, "CreateContribution", mock.Anything)
	mockRepo.AssertNotCalled(t, "UpdateCurrentAmount", mock.Anything, mock.Anything)
}

func TestProcessIncomingTransaction_SkipExpenseType(t *testing.T) {
	mockRepo := new(MockSavingsGoalRepository)
	uc := NewSavingsGoalUsecase(mockRepo)

	accountID := uuid.New()
	txID := uuid.New()

	tx := entity.Transaction{
		ID:        txID,
		AccountID: &accountID,
		Type:      "expense", // Not income or transfer — should be skipped
		Amount:    5000000,
	}

	err := uc.ProcessIncomingTransaction(tx)
	assert.NoError(t, err)

	// Should not even look for sources
	mockRepo.AssertNotCalled(t, "FindAutoSourcesByAccountID", mock.Anything)
}

func TestProcessIncomingTransaction_NoAccountID(t *testing.T) {
	mockRepo := new(MockSavingsGoalRepository)
	uc := NewSavingsGoalUsecase(mockRepo)

	tx := entity.Transaction{
		ID:        uuid.New(),
		AccountID: nil, // No account linked
		Type:      "income",
		Amount:    5000000,
	}

	err := uc.ProcessIncomingTransaction(tx)
	assert.NoError(t, err)

	mockRepo.AssertNotCalled(t, "FindAutoSourcesByAccountID", mock.Anything)
}

func TestProcessIncomingTransaction_GoalAchieved(t *testing.T) {
	mockRepo := new(MockSavingsGoalRepository)
	uc := NewSavingsGoalUsecase(mockRepo)

	accountID := uuid.New()
	goalID := uuid.New()
	sourceID := uuid.New()
	txID := uuid.New()
	userID := uuid.New()

	tx := entity.Transaction{
		ID:        txID,
		AccountID: &accountID,
		Type:      "income",
		Amount:    10000000, // This pushes current from 95M to 105M (target 100M)
	}

	mockRepo.On("FindAutoSourcesByAccountID", accountID).Return([]entity.SavingsGoalSource{
		{
			ID: sourceID, GoalID: goalID, SourceType: "saving_account", TrackingMode: "auto", AccountID: &accountID,
			Goal: &entity.SavingsGoal{ID: goalID, UserID: userID, Status: "active", TargetAmount: 100000000, CurrentAmount: 95000000},
		},
	}, nil)

	mockRepo.On("FindContributionByTransactionID", txID).Return(nil, errors.New("not found"))
	mockRepo.On("FindAllocationsByAccountID", accountID).Return([]entity.SavingsGoalAllocation{}, nil)
	mockRepo.On("CreateContribution", mock.AnythingOfType("*entity.SavingsGoalContribution")).Return(nil)
	mockRepo.On("UpdateCurrentAmount", goalID, float64(10000000)).Return(nil)
	mockRepo.On("UpdateSource", mock.AnythingOfType("*entity.SavingsGoalSource")).Return(nil)

	// After update, current = 105M >= target = 100M → should be achieved
	mockRepo.On("FindByID", goalID).Return(&entity.SavingsGoal{
		ID: goalID, UserID: userID, Status: "active", TargetAmount: 100000000, CurrentAmount: 105000000,
	}, nil)

	// Status should be updated to achieved
	mockRepo.On("Update", mock.MatchedBy(func(g *entity.SavingsGoal) bool {
		return g.Status == "achieved" && g.AchievedAt != nil
	})).Return(nil)

	err := uc.ProcessIncomingTransaction(tx)
	assert.NoError(t, err)

	// Verify goal was marked as achieved
	mockRepo.AssertCalled(t, "Update", mock.MatchedBy(func(g *entity.SavingsGoal) bool {
		return g.Status == "achieved"
	}))
}

func TestAddContribution_ManualSuccess(t *testing.T) {
	mockRepo := new(MockSavingsGoalRepository)
	uc := NewSavingsGoalUsecase(mockRepo)

	goalID := uuid.New()
	sourceID := uuid.New()
	userID := uuid.New()

	mockRepo.On("FindByID", goalID).Return(&entity.SavingsGoal{
		ID: goalID, UserID: userID, Status: "active", TargetAmount: 100000000, CurrentAmount: 50000000,
	}, nil)

	mockRepo.On("CreateContribution", mock.AnythingOfType("*entity.SavingsGoalContribution")).Return(nil)
	mockRepo.On("UpdateCurrentAmount", goalID, float64(5000000)).Return(nil)
	mockRepo.On("FindSourceByID", sourceID).Return(&entity.SavingsGoalSource{
		ID: sourceID, GoalID: goalID, CurrentAmount: 30000000,
	}, nil)
	mockRepo.On("UpdateSource", mock.AnythingOfType("*entity.SavingsGoalSource")).Return(nil)

	// After contribution, not achieved yet
	mockRepo.On("FindByID", goalID).Return(&entity.SavingsGoal{
		ID: goalID, UserID: userID, Status: "active", TargetAmount: 100000000, CurrentAmount: 55000000,
	}, nil)

	input := AddContributionInput{
		SourceID: sourceID,
		Amount:   5000000,
		Type:     "manual",
	}

	contribution, err := uc.AddContribution(goalID, userID, input)
	assert.NoError(t, err)
	assert.NotNil(t, contribution)
}

func TestAddContribution_WithdrawExceedsBalance(t *testing.T) {
	mockRepo := new(MockSavingsGoalRepository)
	uc := NewSavingsGoalUsecase(mockRepo)

	goalID := uuid.New()
	sourceID := uuid.New()
	userID := uuid.New()

	mockRepo.On("FindByID", goalID).Return(&entity.SavingsGoal{
		ID: goalID, UserID: userID, Status: "active", TargetAmount: 100000000, CurrentAmount: 5000000,
	}, nil)

	input := AddContributionInput{
		SourceID: sourceID,
		Amount:   10000000, // Trying to withdraw 10M but only 5M available
		Type:     "withdraw",
	}

	contribution, err := uc.AddContribution(goalID, userID, input)
	assert.Error(t, err)
	assert.Nil(t, contribution)
	assert.Contains(t, err.Error(), "withdraw amount exceeds")
}

func TestAddContribution_GoalNotActive(t *testing.T) {
	mockRepo := new(MockSavingsGoalRepository)
	uc := NewSavingsGoalUsecase(mockRepo)

	goalID := uuid.New()
	sourceID := uuid.New()
	userID := uuid.New()

	mockRepo.On("FindByID", goalID).Return(&entity.SavingsGoal{
		ID: goalID, UserID: userID, Status: "paused", TargetAmount: 100000000, CurrentAmount: 50000000,
	}, nil)

	input := AddContributionInput{
		SourceID: sourceID,
		Amount:   5000000,
		Type:     "manual",
	}

	contribution, err := uc.AddContribution(goalID, userID, input)
	assert.Error(t, err)
	assert.Nil(t, contribution)
	assert.Contains(t, err.Error(), "can only contribute to active goals")
}

func TestResolveTrackingMode(t *testing.T) {
	mockRepo := new(MockSavingsGoalRepository)
	uc := NewSavingsGoalUsecase(mockRepo).(*savingsGoalUsecase)

	// saving_account + auto → auto
	assert.Equal(t, "auto", uc.resolveTrackingMode("saving_account", "auto"))

	// saving_account + manual → manual
	assert.Equal(t, "manual", uc.resolveTrackingMode("saving_account", "manual"))

	// stocks + auto → manual (forced)
	assert.Equal(t, "manual", uc.resolveTrackingMode("stocks", "auto"))

	// gold + auto → manual (forced)
	assert.Equal(t, "manual", uc.resolveTrackingMode("gold", "auto"))

	// crypto + auto → manual (forced)
	assert.Equal(t, "manual", uc.resolveTrackingMode("crypto", "auto"))

	// reksadana + manual → manual
	assert.Equal(t, "manual", uc.resolveTrackingMode("reksadana", "manual"))
}

func TestSetAllocations_ExceedHundredPercent(t *testing.T) {
	mockRepo := new(MockSavingsGoalRepository)
	uc := NewSavingsGoalUsecase(mockRepo)

	userID := uuid.New()
	accountID := uuid.New()

	input := []SetAllocationInput{
		{AccountID: accountID, GoalID: uuid.New(), SourceID: uuid.New(), Percentage: 70},
		{AccountID: accountID, GoalID: uuid.New(), SourceID: uuid.New(), Percentage: 40}, // 70 + 40 = 110 > 100
	}

	err := uc.SetAllocations(userID, input)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "cannot exceed 100%")
}
