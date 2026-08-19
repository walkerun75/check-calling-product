"use client";
import { useEffect,useState } from "react";
type Theme="dark"|"light";
export default function ThemeToggle(){
 const [theme,setTheme]=useState<Theme>("dark");
 useEffect(()=>{const saved=localStorage.getItem("check-calling-launch-theme");const initial:Theme=saved==="light"?"light":"dark";setTheme(initial);document.documentElement.dataset.launchTheme=initial},[]);
 function toggle(){const next:Theme=theme==="dark"?"light":"dark";setTheme(next);document.documentElement.dataset.launchTheme=next;localStorage.setItem("check-calling-launch-theme",next)}
 return <button className="launch-theme-toggle" type="button" onClick={toggle} aria-label={`Switch to ${theme==="dark"?"light":"dark"} theme`} title={`Switch to ${theme==="dark"?"light":"dark"} theme`}><span aria-hidden="true">{theme==="dark"?"☀":"☾"}</span></button>
}
