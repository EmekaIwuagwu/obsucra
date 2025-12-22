package zkp

import (
	"fmt"
	"math/big"
	"os"

	"github.com/consensys/gnark-crypto/ecc"
	"github.com/consensys/gnark/backend/groth16"
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

	fmt.Println("ZKP Proof generated successfully for value in range.")
	return proof, nil
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
