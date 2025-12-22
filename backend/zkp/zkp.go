package zkp

import (
	"fmt"
	"math/big"
	"os"

	"github.com/consensys/gnark-crypto/ecc"
	"github.com/consensys/gnark/backend/groth16"
	gnarkproof "github.com/consensys/gnark/backend/groth16/bn254"
	"github.com/consensys/gnark/constraint"
	"github.com/consensys/gnark/frontend"
	"github.com/consensys/gnark/frontend/cs/r1cs"
)

// DataPrivacyCircuit defines a simple circuit to prove a value is within a range [Min, Max]
// without revealing the actual value (Obscura Mode).
type DataPrivacyCircuit struct {
	Value frontend.Variable `gnark:",secret"`
	Min   frontend.Variable `gnark:",public"`
	Max   frontend.Variable `gnark:",public"`
}

func (circuit *DataPrivacyCircuit) Define(api frontend.API) error {
	api.AssertIsLessOrEqual(circuit.Min, circuit.Value)
	api.AssertIsLessOrEqual(circuit.Value, circuit.Max)
	return nil
}

// AggregationCircuit proves that 'Average' is the arithmetic mean of 'Values'
type AggregationCircuit struct {
    Values [5]frontend.Variable `gnark:",secret"` // Fixed size for prototype
    Average frontend.Variable   `gnark:",public"`
}

func (circuit *AggregationCircuit) Define(api frontend.API) error {
    sum := frontend.Variable(0)
    for i := 0; i < len(circuit.Values); i++ {
        sum = api.Add(sum, circuit.Values[i])
    }
    
    // Average * N == Sum
    // We avoid division in circuits, we use multiplication check
	n := frontend.Variable(len(circuit.Values))
    calcSum := api.Mul(circuit.Average, n)
    
    api.AssertIsEqual(sum, calcSum)
    return nil
}

var (
	groth16PK groth16.ProvingKey
	groth16VK groth16.VerifyingKey
	r1csCCS   constraint.ConstraintSystem
)

func Init() error {
	var circuit DataPrivacyCircuit
	var err error
	
	// Compile the circuit once
	r1csCCS, err = frontend.Compile(ecc.BN254.ScalarField(), r1cs.NewBuilder, &circuit)
	if err != nil {
		return fmt.Errorf("circuit compilation failed: %v", err)
	}

	// Perform trusted setup once
	groth16PK, groth16VK, err = groth16.Setup(r1csCCS)
	if err != nil {
		return fmt.Errorf("trusted setup failed: %v", err)
	}
	
	return nil
}

func GenerateProof(value, min, max *big.Int) (groth16.Proof, error) {
	if r1csCCS == nil || groth16PK == nil {
		return nil, fmt.Errorf("ZKP system not initialized")
	}

	assignment := DataPrivacyCircuit{
		Value: value,
		Min:   min,
		Max:   max,
	}

	witness, _ := frontend.NewWitness(&assignment, ecc.BN254.ScalarField())
	proof, err := groth16.Prove(r1csCCS, groth16PK, witness)
	if err != nil {
		return nil, err
	}

	return proof, nil
}

// SerializeProof converts a Groth16 proof to [8]*big.Int for Solidity
func SerializeProof(proof groth16.Proof) ([8]*big.Int, error) {
	var res [8]*big.Int
	
	_proof, ok := proof.(*gnarkproof.Proof)
	if !ok {
		return res, fmt.Errorf("unsupported proof type")
	}

	res[0] = _proof.Ar.X.BigInt(new(big.Int))
	res[1] = _proof.Ar.Y.BigInt(new(big.Int))
	res[2] = _proof.Bs.X.A1.BigInt(new(big.Int))
	res[3] = _proof.Bs.X.A0.BigInt(new(big.Int))
	res[4] = _proof.Bs.Y.A1.BigInt(new(big.Int))
	res[5] = _proof.Bs.Y.A0.BigInt(new(big.Int))
	res[6] = _proof.Krs.X.BigInt(new(big.Int))
	res[7] = _proof.Krs.Y.BigInt(new(big.Int))

	return res, nil
}

func ExportSolidityVerifier(outputPath string) error {
	var circuit DataPrivacyCircuit
	ccs, err := frontend.Compile(ecc.BN254.ScalarField(), r1cs.NewBuilder, &circuit)
	if err != nil {
		return err
	}

	_, vk, err := groth16.Setup(ccs)
	if err != nil {
		return err
	}

	f, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer f.Close()

	return vk.ExportSolidity(f)
}
