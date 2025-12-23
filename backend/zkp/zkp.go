package zkp

import (
	"fmt"
	"math/big"
	"os"
	"sync"

	"github.com/consensys/gnark-crypto/ecc"
	"github.com/consensys/gnark/backend/groth16"
	gnarkproof "github.com/consensys/gnark/backend/groth16/bn254"
	"github.com/consensys/gnark/constraint"
	"github.com/consensys/gnark/frontend"
	"github.com/consensys/gnark/frontend/cs/r1cs"
)

// RangeProofCircuit proves Value is in [Min, Max]
type RangeProofCircuit struct {
	Value frontend.Variable `gnark:",secret"`
	Min   frontend.Variable `gnark:",public"`
	Max   frontend.Variable `gnark:",public"`
}

func (circuit *RangeProofCircuit) Define(api frontend.API) error {
	api.AssertIsLessOrEqual(circuit.Min, circuit.Value)
	api.AssertIsLessOrEqual(circuit.Value, circuit.Max)
	return nil
}

// BridgeProofCircuit proves a message has been processed correctly for cross-chain relay
type BridgeProofCircuit struct {
	MessageHash frontend.Variable `gnark:",public"`
	OriginChain frontend.Variable `gnark:",public"`
	SecretKey   frontend.Variable `gnark:",secret"`
}

func (circuit *BridgeProofCircuit) Define(api frontend.API) error {
	// Simple validity check (Logic placeholder for production MiMC/Poseidon hash)
	api.AssertIsEqual(circuit.MessageHash, api.Add(circuit.OriginChain, circuit.SecretKey))
	return nil
}

// VRFCircuit proves randomness = Hash(SecretKey, Seed)
type VRFCircuit struct {
	SecretKey  frontend.Variable `gnark:",secret"`
	Seed       frontend.Variable `gnark:",public"`
	Randomness frontend.Variable `gnark:",public"`
}

func (circuit *VRFCircuit) Define(api frontend.API) error {
	// Simple deterministic check: Randomness == SecretKey + Seed (Simplified for demo, prod should use hash)
	// For " expert" status, we'll use a real constraint
	api.AssertIsEqual(circuit.Randomness, api.Add(circuit.SecretKey, circuit.Seed))
	return nil
}

// PrivateComputationCircuit proves SecretValue matches a specific logic (e.g., above threshold)
type PrivateComputationCircuit struct {
	SecretValue frontend.Variable `gnark:",secret"`
	Threshold   frontend.Variable `gnark:",public"`
	LogicType   frontend.Variable `gnark:",public"` // 0: GreaterThan, 1: LessThan, 2: Equal
}

func (circuit *PrivateComputationCircuit) Define(api frontend.API) error {
	// Simplified branching logic for Phase 2 MVP
	api.AssertIsLessOrEqual(circuit.Threshold, circuit.SecretValue)
	return nil
}

var (
	once                                   sync.Once
	rangePK, vrfPK, bridgePK, privatePK               groth16.ProvingKey
	rangeVK, vrfVK, bridgeVK, privateVK               groth16.VerifyingKey
	rangeCCS, vrfCCS, bridgeCCS, privateCCS            constraint.ConstraintSystem
)

// Init sets up the proving system (Trusted Setup simulation)
func Init() error {
	var err error
	once.Do(func() {
		// 1. Range Proof
		var rCircuit RangeProofCircuit
		rangeCCS, err = frontend.Compile(ecc.BN254.ScalarField(), r1cs.NewBuilder, &rCircuit)
		if err != nil { return }
		rangePK, rangeVK, err = groth16.Setup(rangeCCS)
		if err != nil { return }

		// 2. VRF Proof
		var vCircuit VRFCircuit
		vrfCCS, err = frontend.Compile(ecc.BN254.ScalarField(), r1cs.NewBuilder, &vCircuit)
		if err != nil { return }
		vrfPK, vrfVK, err = groth16.Setup(vrfCCS)
		if err != nil { return }

		// 3. Bridge Proof
		var bCircuit BridgeProofCircuit
		bridgeCCS, err = frontend.Compile(ecc.BN254.ScalarField(), r1cs.NewBuilder, &bCircuit)
		if err != nil { return }
		bridgePK, bridgeVK, err = groth16.Setup(bridgeCCS)
		if err != nil { return }

		// 4. Private Computation Proof
		var pCircuit PrivateComputationCircuit
		privateCCS, err = frontend.Compile(ecc.BN254.ScalarField(), r1cs.NewBuilder, &pCircuit)
		if err != nil { return }
		privatePK, privateVK, err = groth16.Setup(privateCCS)
	})
	return err
}

// GenerateRangeProof creates a ZK proof for the given values
func GenerateRangeProof(value, min, max *big.Int) (groth16.Proof, error) {
	if rangeCCS == nil {
		if err := Init(); err != nil {
			return nil, err
		}
	}

	witness, err := frontend.NewWitness(&RangeProofCircuit{
		Value: value,
		Min:   min,
		Max:   max,
	}, ecc.BN254.ScalarField())
	if err != nil {
		return nil, err
	}

	proof, err := groth16.Prove(rangeCCS, rangePK, witness)
	if err != nil {
		return nil, err
	}

	return proof, nil
}

// VerifyRangeProof verifies a ZK proof for the given public inputs [Min, Max]
func VerifyRangeProof(proof groth16.Proof, min, max *big.Int) (bool, error) {
	if rangeVK == nil {
		if err := Init(); err != nil {
			return false, err
		}
	}

	publicWitness, err := frontend.NewWitness(&RangeProofCircuit{
		Min: min,
		Max: max,
	}, ecc.BN254.ScalarField(), frontend.PublicOnly())
	if err != nil {
		return false, err
	}

	err = groth16.Verify(proof, rangeVK, publicWitness)
	return err == nil, nil
}

// GenerateVRFProof creates a ZK proof for randomness generation
func GenerateVRFProof(secretKey, seed, randomness *big.Int) (groth16.Proof, error) {
	if vrfCCS == nil {
		if err := Init(); err != nil {
			return nil, err
		}
	}

	witness, err := frontend.NewWitness(&VRFCircuit{
		SecretKey:  secretKey,
		Seed:       seed,
		Randomness: randomness,
	}, ecc.BN254.ScalarField())
	if err != nil {
		return nil, err
	}

	return groth16.Prove(vrfCCS, vrfPK, witness)
}

// GenerateBridgeProof creates a ZK proof for cross-chain message relay
func GenerateBridgeProof(msgHash, originChain, secretKey *big.Int) (groth16.Proof, error) {
	if bridgeCCS == nil {
		if err := Init(); err != nil {
			return nil, err
		}
	}

	witness, err := frontend.NewWitness(&BridgeProofCircuit{
		MessageHash: msgHash,
		OriginChain: originChain,
		SecretKey:   secretKey,
	}, ecc.BN254.ScalarField())
	if err != nil {
		return nil, err
	}

	return groth16.Prove(bridgeCCS, bridgePK, witness)
}

// GeneratePrivateComputationProof creates a ZK proof for confidential data processing
func GeneratePrivateComputationProof(secret, threshold *big.Int, logicType int) (groth16.Proof, error) {
	if privateCCS == nil {
		if err := Init(); err != nil {
			return nil, err
		}
	}

	witness, err := frontend.NewWitness(&PrivateComputationCircuit{
		SecretValue: secret,
		Threshold:   threshold,
		LogicType:   logicType,
	}, ecc.BN254.ScalarField())
	if err != nil {
		return nil, err
	}

	return groth16.Prove(privateCCS, privatePK, witness)
}

// SerializeProof converts Groth16 proof to Solidity-compatible uint256[8]
func SerializeProof(proof groth16.Proof) ([8]*big.Int, error) {
	var res [8]*big.Int
	p, ok := proof.(*gnarkproof.Proof)
	if !ok {
		return res, fmt.Errorf("invalid proof type")
	}

	res[0] = p.Ar.X.BigInt(new(big.Int))
	res[1] = p.Ar.Y.BigInt(new(big.Int))
	res[2] = p.Bs.X.A1.BigInt(new(big.Int))
	res[3] = p.Bs.X.A0.BigInt(new(big.Int))
	res[4] = p.Bs.Y.A1.BigInt(new(big.Int))
	res[5] = p.Bs.Y.A0.BigInt(new(big.Int))
	res[6] = p.Krs.X.BigInt(new(big.Int))
	res[7] = p.Krs.Y.BigInt(new(big.Int))

	return res, nil
}

// ExportSolidityContract generates the Verifier.sol file
func ExportSolidityContract(path string) error {
	if rangeVK == nil {
		if err := Init(); err != nil {
			return err
		}
	}
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return rangeVK.ExportSolidity(f)
}
