import pandas as pd
import numpy as np
import argparse


def calibrate(df, adc_bits, adc_range_mV):
    """
    Convert raw ECG counts to µV and remove baseline drift for each lead
    """
    calibrated = df.copy()
    for lead in calibrated.columns:
        # Convert counts -> µV
        calibrated[lead] = (calibrated[lead] * adc_range_mV * 1000) / (2**adc_bits)
        # Remove baseline (mean)
        calibrated[lead] = calibrated[lead] - np.mean(calibrated[lead])
    return calibrated


def main():
    parser = argparse.ArgumentParser(description="Calibrate Fukuda ECG CSV to µV")
    parser.add_argument("input_csv", help="Input CSV file (raw Huffman decompressed)")
    parser.add_argument("output_csv", help="Output CSV file (calibrated in µV)")
    parser.add_argument(
        "--adc_bits", type=int, default=12, help="ADC resolution in bits (default: 12)"
    )
    parser.add_argument(
        "--adc_range",
        type=float,
        default=10.0,
        help="ADC total range in mV (default: 10 mV for ±5 mV)",
    )
    args = parser.parse_args()

    # Load CSV
    df = pd.read_csv(args.input_csv)

    # Calibrate
    calibrated_df = calibrate(df, args.adc_bits, args.adc_range)

    # Save output
    calibrated_df.to_csv(args.output_csv, index=False)
    print(f"✅ Calibrated CSV saved to {args.output_csv}")


if __name__ == "__main__":
    main()
