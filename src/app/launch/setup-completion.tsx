"use client";

import { usePathname } from "next/navigation";
import { updateLaunchStep } from "./actions";
import "./setup-completion.css";

const setupByPath: Record<string,{key:string;label:string}> = {
  "/launch/business": { key:"business", label:"Team" },
  "/launch/hours": { key:"rules", label:"Booking & Business Hours" },
  "/launch/fleet": { key:"fleet", label:"Fleet Setup" },
  "/launch/approval": { key:"approval", label:"Renter Evaluation" },
  "/launch/payments": { key:"payments", label:"Payments, Taxes & Protection" },
  "/launch/agreements": { key:"agreements", label:"Agreements & Automation" },
  "/launch/website": { key:"website", label:"Website & Booking Engine" },
};

export default function SetupCompletion(){
  const pathname=usePathname();
  const setup=setupByPath[pathname];
  if(!setup)return null;
  return <section className="global-setup-completion">
    <div><strong>{setup.label}</strong><p>Save your changes above, then mark this setup complete. You can return later to edit it.</p></div>
    <form action={updateLaunchStep}><input type="hidden" name="stepKey" value={setup.key}/><input type="hidden" name="intent" value="complete"/><button>Complete setup</button></form>
  </section>;
}
