"use client";

import Link from "next/link";
import {useEffect,useState} from "react";

type Origin="intelligence"|"command"|"calendar"|"porter";
const destinations:Record<Origin,{href:string;label:string}>={
  intelligence:{href:"/dashboard/vehicle-intelligence",label:"Return to Vehicle Intelligence"},
  command:{href:"/dashboard/command-center",label:"Return to Command Center"},
  calendar:{href:"/dashboard/smart-calendar",label:"Return to Smart Calendar"},
  porter:{href:"/dashboard/fleet-workshop",label:"Return to porter queue"},
};

export default function WorkshopReturnLink({initialOrigin,fallbackOrigin="command",compact=false}:{initialOrigin?:string;fallbackOrigin?:Origin;compact?:boolean}){
  const valid=initialOrigin&&initialOrigin in destinations?initialOrigin as Origin:null;
  const [origin,setOrigin]=useState<Origin>(valid??fallbackOrigin);
  useEffect(()=>{
    if(valid){sessionStorage.setItem("fleet-workshop-origin",valid);setOrigin(valid);return;}
    const saved=sessionStorage.getItem("fleet-workshop-origin");
    if(saved&&saved in destinations)setOrigin(saved as Origin);
  },[valid]);
  const destination=destinations[origin];
  return <Link className={compact?"workshop-return-compact":undefined} href={destination.href}>{compact?destination.label:`← ${destination.label}`}</Link>;
}
