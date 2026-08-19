"use client";

import { useState } from "react";
import { saveOperatingHours } from "./actions";

type HoursRow = { day: string; from: string; until: string };
type Settings = {
  orderSource?: string; onlineReservations?: boolean; hostedStore?: boolean; showPrices?: boolean;
  enabled?: boolean; defaultPickupTime?: string; schedule?: HoursRow[]; preventLastMinute?: boolean;
  awayMode?: boolean; requireApproval?: boolean; cancellation?: string;
  existingWebsiteUrl?: string; integrationReturnUrl?: string;
};

export function HoursForm({ settings }: { settings: Settings }) {
  const [rows, setRows] = useState<HoursRow[]>(settings.schedule?.length ? settings.schedule : [{ day: "Everyday", from: "08:00", until: "17:00" }]);
  const [orderSource, setOrderSource] = useState(settings.orderSource ?? "booking-page");
  const [copiedLink, setCopiedLink] = useState(false);
  const bookingUrl = "https://book.checkcalling.com/your-business";
  const copyBookingLink = async () => {
    await navigator.clipboard.writeText(bookingUrl);
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 2000);
  };
  const update = (index: number, key: keyof HoursRow, value: string) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  return <form action={saveOperatingHours} className="hours-form">
    <section className="hours-card online-orders"><h2>Booking channel</h2><p className="channel-help">Choose the customer booking experience you plan to use.</p><div className="radio-row">
      {[['booking-page','Booking page'],['website-builder','Website builder'],['website-integration','Website integration']].map(([value,label])=><label className={orderSource===value?'selected':''} key={value}><input type="radio" name="orderSource" value={value} checked={orderSource===value} onChange={()=>setOrderSource(value)}/><span>{label}</span>{value==='booking-page'&&<em>Included</em>}{value==='website-builder'&&<em>Add-on</em>}</label>)}
    </div>
    {orderSource==='booking-page'&&<div className="channel-panel"><div><strong>Check Calling rental booking page</strong><p>Included with the host subscription. Vehicles, availability, rates, and reservation rules are supplied by Check Calling.</p></div><label>Hosted booking link<div className="link-box"><input readOnly value={bookingUrl}/><button type="button" className={copiedLink?'copied':''} onClick={copyBookingLink}>{copiedLink?'✓ Copied!':'Copy link'}</button></div></label><span className="copy-status" aria-live="polite">{copiedLink?'Booking link copied to your clipboard.':''}</span></div>}
    {orderSource==='website-builder'&&<div className="channel-panel upgrade-panel"><div><strong>Website Builder add-on</strong><span className="upgrade-badge">Upgrade required</span><p>A complete branded rental website connected to the host’s fleet, availability, pricing, and checkout.</p></div><a className="upgrade-link" href="mailto:sales@checkcalling.com?subject=Check%20Calling%20Website%20Builder%20Upgrade">View upgrade options</a></div>}
    {orderSource==='website-integration'&&<div className="channel-panel integration-panel"><div><strong>Connect an existing website</strong><p>Add the host’s website and return address. Check Calling supplies the secure booking link; private backend keys are never displayed here.</p></div><label>Existing website URL<input name="existingWebsiteUrl" type="url" placeholder="https://yourwebsite.com" defaultValue={settings.existingWebsiteUrl}/></label><label>Check Calling booking link<div className="link-box"><input readOnly value={bookingUrl}/><button type="button" className={copiedLink?'copied':''} onClick={copyBookingLink}>{copiedLink?'✓ Copied!':'Copy link'}</button></div></label><span className="copy-status" aria-live="polite">{copiedLink?'Booking link copied to your clipboard.':''}</span><label>Return URL after booking<input name="integrationReturnUrl" type="url" placeholder="https://yourwebsite.com/booking-confirmed" defaultValue={settings.integrationReturnUrl}/></label></div>}
    </section>
    <div className="settings-row"><div className="setting-copy"><h3>General</h3><p>Control how customers create reservations and what appears on your online checkout.</p></div><section className="hours-card checks"><label><input type="checkbox" name="onlineReservations" defaultChecked={settings.onlineReservations??true}/> Enable online reservations</label><label><input type="checkbox" name="hostedStore" defaultChecked={settings.hostedStore}/> Feature hosted online store</label><label><input type="checkbox" name="showPrices" defaultChecked={settings.showPrices}/> Show prices on listing cards</label></section></div>
    <div className="settings-row"><div className="setting-copy"><h3>Business Hours</h3><p>Set the business hours customers can select for pickups and returns.</p></div><section className="hours-card operating-card">
      <label className="default-time">Default pickup time <input type="time" name="defaultPickupTime" defaultValue={settings.defaultPickupTime??'08:00'}/></label>
      <label><input type="checkbox" name="hoursEnabled" defaultChecked={settings.enabled??true}/> Enable business hours</label>
      <div className="hours-head"><span>Day</span><span>From</span><span>Until</span><span/></div>
      {rows.map((row,index)=><div className="hours-line" key={index}><select name="day" value={row.day} onChange={(event)=>update(index,'day',event.target.value)}>{['Everyday','Weekdays','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day=><option key={day}>{day}</option>)}</select><input type="time" name="from" value={row.from} onChange={(event)=>update(index,'from',event.target.value)}/><input type="time" name="until" value={row.until} onChange={(event)=>update(index,'until',event.target.value)}/><button type="button" className="remove-hours" onClick={()=>setRows(current=>current.filter((_,rowIndex)=>rowIndex!==index))}>Remove</button></div>)}
      <button type="button" className="add-hours" onClick={()=>setRows(current=>[...current,{day:'Monday',from:'08:00',until:'17:00'}])}>＋ Add hours</button>
      <label><input type="checkbox" name="preventLastMinute" defaultChecked={settings.preventLastMinute}/> Prevent last-minute reservations</label><label><input type="checkbox" name="awayMode" defaultChecked={settings.awayMode}/> Enable away mode</label>
      <button className="save-hours">Save business hours</button>
    </section></div>
    <div className="settings-row"><div className="setting-copy"><h3>Booking requests</h3><p>Require approval before an online request becomes a confirmed reservation.</p></div><section className="hours-card checks"><label><input type="checkbox" name="requireApproval" defaultChecked={settings.requireApproval}/> Require approval</label></section></div>
    <div className="settings-row"><div className="setting-copy"><h3>Guest cancellation</h3><p>Choose whether customers can cancel confirmed reservations online.</p></div><section className="hours-card checks"><label><input type="radio" name="cancellation" value="not-allowed" defaultChecked={(settings.cancellation??'not-allowed')==='not-allowed'}/> Do not allow cancellation</label><label><input type="radio" name="cancellation" value="online" defaultChecked={settings.cancellation==='online'}/> Allow cancellation online</label></section></div>
  </form>;
}
