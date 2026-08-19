"use client";

import { useState } from "react";
import { createVehicle } from "./actions";

type Vehicle = { vin:string; year:string; make:string; model:string; trim:string };

export default function VinForm({ initialError, returnToLaunch=false }: { initialError?:string;returnToLaunch?:boolean }) {
  const [mode,setMode]=useState<"vin"|"manual">("vin");
  const [vin,setVin]=useState("");
  const [vehicle,setVehicle]=useState<Vehicle|null>(null);
  const [message,setMessage]=useState(initialError??"");
  const [loading,setLoading]=useState(false);

  async function decode(){
    setLoading(true);setMessage("");setVehicle(null);
    try{const response=await fetch(`/api/vin/${vin}`);const data=await response.json();if(!response.ok)throw new Error(data.error);setVehicle(data)}
    catch(error){setMessage(error instanceof Error?error.message:"VIN lookup failed.")}
    finally{setLoading(false)}
  }

  const hidden=<><input type="hidden" name="returnToLaunch" value={returnToLaunch?"1":"0"}/><input type="hidden" name="entry_mode" value={mode}/></>;
  return <>
    <div className="vehicle-intake-choice" role="tablist" aria-label="Vehicle entry method">
      <button className={mode==="vin"?"active":""} type="button" onClick={()=>setMode("vin")}>Decode by VIN</button>
      <button className={mode==="manual"?"active":""} type="button" onClick={()=>setMode("manual")}>Enter manually</button>
    </div>
    {message&&<p className="alert" role="alert">{message}</p>}
    {mode==="vin"&&<>
      <div className="field"><label htmlFor="vin-lookup">17-character VIN</label><div className="nav"><input id="vin-lookup" value={vin} onChange={event=>setVin(event.target.value.toUpperCase())} maxLength={17} placeholder="Enter vehicle VIN" style={{flex:1}}/><button className="button" type="button" onClick={decode} disabled={loading||vin.length!==17}>{loading?"Decoding…":"Decode VIN"}</button></div></div>
      {vehicle&&<form action={createVehicle} className="form" style={{marginTop:22}}>{hidden}<input type="hidden" name="vin" value={vehicle.vin}/><div className="alert success">VIN decoded. Review the information before saving.</div><VehicleFields vehicle={vehicle}/><VehicleImages/><button className="button" type="submit">Save vehicle to Fleet</button></form>}
    </>}
    {mode==="manual"&&<form action={createVehicle} className="form" style={{marginTop:22}}>{hidden}<div className="alert">Enter the vehicle yourself and upload the images that should represent it throughout the portal.</div><div className="field"><label>VIN (optional)</label><input name="vin" maxLength={17} placeholder="Leave blank if unavailable"/></div><VehicleFields/><VehicleImages/><button className="button" type="submit">Save manual vehicle</button></form>}
  </>;
}

function VehicleFields({vehicle}:{vehicle?:Vehicle}){
  return <><div className="two"><div className="field"><label>Year</label><input name="year" type="number" min="1900" defaultValue={vehicle?.year} required/></div><div className="field"><label>Make</label><input name="make" defaultValue={vehicle?.make} required/></div></div><div className="two"><div className="field"><label>Model</label><input name="model" defaultValue={vehicle?.model} required/></div><div className="field"><label>Trim</label><input name="trim" defaultValue={vehicle?.trim}/></div></div><div className="two"><div className="field"><label>License plate</label><input name="license_plate"/></div><div className="field"><label>Odometer</label><input name="odometer" type="number" min="0"/></div></div><div className="field"><label>Daily rental rate</label><input name="daily_rate" type="number" min="0" step="0.01" placeholder="350.00"/></div></>;
}

function VehicleImages(){
  return <div className="field vehicle-image-upload"><label htmlFor="vehicle-images">Upload vehicle images</label><input id="vehicle-images" name="vehicle_images" type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple/><small>The first image becomes the primary vehicle image used in Asset Pulse and vehicle listings.</small></div>;
}
