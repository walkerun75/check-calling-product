import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ vin: string }> }) {
  const { vin: rawVin } = await params;
  const vin = rawVin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
  if (vin.length !== 17) return NextResponse.json({ error:"Enter a valid 17-character VIN." }, { status:400 });
  const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${vin}?format=json`, { next:{ revalidate:86400 } });
  if (!response.ok) return NextResponse.json({ error:"The VIN service is temporarily unavailable." }, { status:502 });
  const payload = await response.json();
  const result = payload?.Results?.[0];
  if (!result || result.ErrorCode?.split(",").some((code:string) => !["0","1","2","3","4","5","6","7","8","9","10","11","12","13","14"].includes(code.trim()))) {
    return NextResponse.json({ error:result?.ErrorText || "VIN could not be decoded." }, { status:422 });
  }
  return NextResponse.json({ vin, year:result.ModelYear || "", make:result.Make || "", model:result.Model || "", trim:result.Trim || result.Series || "", raw:result });
}

