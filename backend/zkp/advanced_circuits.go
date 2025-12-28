package zkp

import (
	"math/big"

	"github.com/consensys/gnark-crypto/ecc"
	"github.com/consensys/gnark/backend/groth16"
	"github.com/consensys/gnark/constraint"
	"github.com/consensys/gnark/frontend"
	"github.com/consensys/gnark/frontend/cs/r1cs"
)

// ============================================================================
// TWAP (Time-Weighted Average Price) Circuit
// ============================================================================

// TWAPCircuit proves that a TWAP value was correctly computed from a set of
// price observations without revealing the individual prices.
//
// Public Inputs:
// - TWAPResult: The claimed TWAP value
// - StartTime: Beginning of the TWAP window
// - EndTime: End of the TWAP window
// - MinBound: Lower bound for the TWAP (range proof)
// - MaxBound: Upper bound for the TWAP (range proof)
//
// Private Inputs:
// - Prices: Array of price observations
// - Timestamps: Corresponding timestamps for each observation
type TWAPCircuit struct {
	// Public inputs
	TWAPResult frontend.Variable `gnark:",public"`
	StartTime  frontend.Variable `gnark:",public"`
	EndTime    frontend.Variable `gnark:",public"`
	MinBound   frontend.Variable `gnark:",public"`
	MaxBound   frontend.Variable `gnark:",public"`

	// Private inputs (hidden from verifier)
	Prices     [10]frontend.Variable `gnark:",secret"`
	Timestamps [10]frontend.Variable `gnark:",secret"`
	NumPoints  frontend.Variable     `gnark:",secret"`
}

func (c *TWAPCircuit) Define(api frontend.API) error {
	// 1. Verify timestamps are within the window
	for i := 0; i < 10; i++ {
		// timestamp >= startTime (or zero if unused)
		api.AssertIsLessOrEqual(c.StartTime, api.Add(c.Timestamps[i], 1))
		// timestamp <= endTime
		api.AssertIsLessOrEqual(c.Timestamps[i], c.EndTime)
	}

	// 2. Calculate time-weighted sum
	// TWAP = Σ(price_i * (t_{i+1} - t_i)) / (t_n - t_0)
	var weightedSum frontend.Variable = frontend.Variable(0)

	for i := 0; i < 9; i++ {
		timeDiff := api.Sub(c.Timestamps[i+1], c.Timestamps[i])
		weighted := api.Mul(c.Prices[i], timeDiff)
		weightedSum = api.Add(weightedSum, weighted)
	}

	totalTime := api.Sub(c.EndTime, c.StartTime)
	expectedTWAP := api.Div(weightedSum, totalTime)

	// 3. Assert TWAP matches claimed value
	api.AssertIsEqual(c.TWAPResult, expectedTWAP)

	// 4. Range proof: TWAP is within bounds
	api.AssertIsLessOrEqual(c.MinBound, c.TWAPResult)
	api.AssertIsLessOrEqual(c.TWAPResult, c.MaxBound)

	return nil
}

// ============================================================================
// Proof of Reserves Circuit (Pedersen Commitment)
// ============================================================================

// ProofOfReservesCircuit proves that committed reserves exceed liabilities
// without revealing the exact amounts.
//
// Uses Pedersen commitments: C = g^r * h^v where r is randomness, v is value
type ProofOfReservesCircuit struct {
	// Public inputs
	ReserveCommitment   frontend.Variable `gnark:",public"`
	LiabilityCommitment frontend.Variable `gnark:",public"`
	SolvencyProof       frontend.Variable `gnark:",public"` // Reserves >= Liabilities

	// Private inputs
	ReserveAmount    frontend.Variable `gnark:",secret"`
	ReserveBlinding  frontend.Variable `gnark:",secret"`
	LiabilityAmount  frontend.Variable `gnark:",secret"`
	LiabilityBlinding frontend.Variable `gnark:",secret"`
}

func (c *ProofOfReservesCircuit) Define(api frontend.API) error {
	// 1. Verify commitment openings (simplified for demo)
	// In production, use MiMC or Poseidon hash for commitments
	reserveCommit := api.Add(c.ReserveAmount, c.ReserveBlinding)
	liabilityCommit := api.Add(c.LiabilityAmount, c.LiabilityBlinding)

	api.AssertIsEqual(c.ReserveCommitment, reserveCommit)
	api.AssertIsEqual(c.LiabilityCommitment, liabilityCommit)

	// 2. Prove solvency: reserves >= liabilities
	api.AssertIsLessOrEqual(c.LiabilityAmount, c.ReserveAmount)

	// 3. Set solvency proof flag
	api.AssertIsEqual(c.SolvencyProof, frontend.Variable(1))

	return nil
}

// ============================================================================
// Selective Disclosure Circuit
// ============================================================================

// SelectiveDisclosureCircuit allows revealing data only to authorized parties
// by encrypting the data to a specific public key.
type SelectiveDisclosureCircuit struct {
	// Public inputs
	DataCommitment   frontend.Variable `gnark:",public"`
	AuthorizedPubKey frontend.Variable `gnark:",public"`
	EncryptedData    frontend.Variable `gnark:",public"`

	// Private inputs
	RawData        frontend.Variable `gnark:",secret"`
	Randomness     frontend.Variable `gnark:",secret"`
	DataInRange    frontend.Variable `gnark:",secret"` // 1 if in range, 0 otherwise
	RangeMin       frontend.Variable `gnark:",public"`
	RangeMax       frontend.Variable `gnark:",public"`
}

func (c *SelectiveDisclosureCircuit) Define(api frontend.API) error {
	// 1. Verify data commitment
	commit := api.Add(c.RawData, c.Randomness)
	api.AssertIsEqual(c.DataCommitment, commit)

	// 2. Verify encryption to authorized key (simplified)
	encrypted := api.Mul(c.RawData, c.AuthorizedPubKey)
	api.AssertIsEqual(c.EncryptedData, encrypted)

	// 3. Range proof for data
	api.AssertIsLessOrEqual(c.RangeMin, c.RawData)
	api.AssertIsLessOrEqual(c.RawData, c.RangeMax)

	return nil
}

// ============================================================================
// Recursive Aggregation Circuit
// ============================================================================

// AggregationCircuit aggregates multiple proofs into a single proof
// This enables batching 1000+ data points into one on-chain verification
type AggregationCircuit struct {
	// Public inputs
	FinalValue     frontend.Variable   `gnark:",public"`
	ProofHashes    [8]frontend.Variable `gnark:",public"` // Up to 8 sub-proofs
	AggregationType frontend.Variable   `gnark:",public"` // 0=median, 1=mean, 2=min, 3=max

	// Private inputs
	SubValues [8]frontend.Variable `gnark:",secret"`
	Weights   [8]frontend.Variable `gnark:",secret"` // For weighted aggregation
}

func (c *AggregationCircuit) Define(api frontend.API) error {
	// 1. Verify proof hashes match sub-values (simplified)
	for i := 0; i < 8; i++ {
		expectedHash := api.Add(c.SubValues[i], frontend.Variable(i))
		api.AssertIsEqual(c.ProofHashes[i], expectedHash)
	}

	// 2. Calculate aggregated value based on type
	// For simplicity, we implement weighted mean here
	var weightedSum frontend.Variable = frontend.Variable(0)
	var totalWeight frontend.Variable = frontend.Variable(0)

	for i := 0; i < 8; i++ {
		weighted := api.Mul(c.SubValues[i], c.Weights[i])
		weightedSum = api.Add(weightedSum, weighted)
		totalWeight = api.Add(totalWeight, c.Weights[i])
	}

	expectedValue := api.Div(weightedSum, totalWeight)
	api.AssertIsEqual(c.FinalValue, expectedValue)

	return nil
}

// ============================================================================
// Circuit Compilation and Setup
// ============================================================================

var (
	twapCCS     constraint.ConstraintSystem
	twapPK      groth16.ProvingKey
	twapVK      groth16.VerifyingKey
	
	porCCS      constraint.ConstraintSystem
	porPK       groth16.ProvingKey
	porVK       groth16.VerifyingKey
	
	sdCCS       constraint.ConstraintSystem
	sdPK        groth16.ProvingKey
	sdVK        groth16.VerifyingKey
	
	aggCCS      constraint.ConstraintSystem
	aggPK       groth16.ProvingKey
	aggVK       groth16.VerifyingKey
)

// InitAdvancedCircuits initializes the advanced ZK circuits
func InitAdvancedCircuits() error {
	var err error

	// 1. TWAP Circuit
	var twapCircuit TWAPCircuit
	twapCCS, err = frontend.Compile(ecc.BN254.ScalarField(), r1cs.NewBuilder, &twapCircuit)
	if err != nil {
		return err
	}
	twapPK, twapVK, err = groth16.Setup(twapCCS)
	if err != nil {
		return err
	}

	// 2. Proof of Reserves Circuit
	var porCircuit ProofOfReservesCircuit
	porCCS, err = frontend.Compile(ecc.BN254.ScalarField(), r1cs.NewBuilder, &porCircuit)
	if err != nil {
		return err
	}
	porPK, porVK, err = groth16.Setup(porCCS)
	if err != nil {
		return err
	}

	// 3. Selective Disclosure Circuit
	var sdCircuit SelectiveDisclosureCircuit
	sdCCS, err = frontend.Compile(ecc.BN254.ScalarField(), r1cs.NewBuilder, &sdCircuit)
	if err != nil {
		return err
	}
	sdPK, sdVK, err = groth16.Setup(sdCCS)
	if err != nil {
		return err
	}

	// 4. Aggregation Circuit
	var aggCircuit AggregationCircuit
	aggCCS, err = frontend.Compile(ecc.BN254.ScalarField(), r1cs.NewBuilder, &aggCircuit)
	if err != nil {
		return err
	}
	aggPK, aggVK, err = groth16.Setup(aggCCS)
	if err != nil {
		return err
	}

	return nil
}

// GenerateTWAPProof creates a ZK proof for TWAP calculation
func GenerateTWAPProof(twap *big.Int, startTime, endTime uint64, minBound, maxBound *big.Int, 
	prices [10]*big.Int, timestamps [10]uint64) (groth16.Proof, error) {
	
	if twapCCS == nil {
		if err := InitAdvancedCircuits(); err != nil {
			return nil, err
		}
	}

	// Convert inputs
	var priceVars [10]frontend.Variable
	var tsVars [10]frontend.Variable
	for i := 0; i < 10; i++ {
		if prices[i] != nil {
			priceVars[i] = prices[i]
		} else {
			priceVars[i] = big.NewInt(0)
		}
		tsVars[i] = timestamps[i]
	}

	witness, err := frontend.NewWitness(&TWAPCircuit{
		TWAPResult: twap,
		StartTime:  startTime,
		EndTime:    endTime,
		MinBound:   minBound,
		MaxBound:   maxBound,
		Prices:     priceVars,
		Timestamps: tsVars,
		NumPoints:  10,
	}, ecc.BN254.ScalarField())
	if err != nil {
		return nil, err
	}

	return groth16.Prove(twapCCS, twapPK, witness)
}

// GenerateProofOfReserves creates a ZK proof for reserve attestation
func GenerateProofOfReserves(reserves, liabilities *big.Int, 
	reserveBlinding, liabilityBlinding *big.Int) (groth16.Proof, error) {
	
	if porCCS == nil {
		if err := InitAdvancedCircuits(); err != nil {
			return nil, err
		}
	}

	reserveCommit := new(big.Int).Add(reserves, reserveBlinding)
	liabilityCommit := new(big.Int).Add(liabilities, liabilityBlinding)

	witness, err := frontend.NewWitness(&ProofOfReservesCircuit{
		ReserveCommitment:   reserveCommit,
		LiabilityCommitment: liabilityCommit,
		SolvencyProof:       big.NewInt(1),
		ReserveAmount:       reserves,
		ReserveBlinding:     reserveBlinding,
		LiabilityAmount:     liabilities,
		LiabilityBlinding:   liabilityBlinding,
	}, ecc.BN254.ScalarField())
	if err != nil {
		return nil, err
	}

	return groth16.Prove(porCCS, porPK, witness)
}

// GetTWAPVerifier returns the TWAP verifier key for export
func GetTWAPVerifier() groth16.VerifyingKey {
	return twapVK
}

// GetPoRVerifier returns the Proof of Reserves verifier key for export
func GetPoRVerifier() groth16.VerifyingKey {
	return porVK
}
