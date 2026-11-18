import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const random = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), x => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[x % 36]).join("");
const token = () => random(40) + crypto.randomUUID().replaceAll("-", "");
const digest = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map(x => x.toString(16).padStart(2,"0")).join("");
let dictionaryPromise: Promise<Set<string>> | null = null;
const getValidWords = () => dictionaryPromise ??= Deno.readTextFile(new URL("./words.txt", import.meta.url)).then(text => new Set(text.trim().split(/\s+/)));
const word = (s: unknown, words: Set<string>) => typeof s === "string" && /^[A-Z]{5}$/.test(s) && words.has(s.toLowerCase());
function score(g: string, a: string) { const ans=a.split(""), letters=g.split(""), tiles=Array(5).fill("absent"); letters.forEach((c,i)=>{if(c===ans[i]){tiles[i]="correct";ans[i]="";letters[i]=""}});letters.forEach((c,i)=>{if(c){const j=ans.indexOf(c);if(j>=0){tiles[i]="present";ans[j]=""}}});return tiles; }
Deno.serve(async req => {
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return reply({error:"POST required"},405);
 try {
  const words = await getValidWords();
  const b=await req.json(), action=b.action;
  if(action==="create"){
   const name=String(b.name||"").trim().slice(0,24); if(!name) return reply({error:"Enter your name."},400);
   let code="", exists=true; for(let i=0;i<6&&exists;i++){code=random(6);const q=await db.from("word_wars_rooms").select("code").eq("code",code).maybeSingle();exists=!!q.data;}
   if(exists)return reply({error:"Could not create a room. Try again."},500);
   const secret=token(),{error}=await db.from("word_wars_rooms").insert({code,host_name:name,host_token_hash:await digest(secret)});
   if(error)throw error;return reply({room:code,token:secret});
  }
  const code=String(b.room||"").toUpperCase(); if(!/^[A-Z0-9]{6}$/.test(code))return reply({error:"Invalid room code."},400);
  if(action==="join"){
   const name=String(b.name||"").trim().slice(0,24);if(!name)return reply({error:"Enter your name."},400);
   const {data:r,error}=await db.from("word_wars_rooms").select("*").eq("code",code).gt("expires_at",new Date().toISOString()).maybeSingle();if(error)throw error;if(!r)return reply({error:"Room not found or expired."},404);
   if(r.guest_token_hash)return reply({error:"This room already has two players."},409);
   const secret=token(),{data:updated,error:e}=await db.from("word_wars_rooms").update({guest_name:name,guest_token_hash:await digest(secret)}).eq("code",code).is("guest_token_hash",null).select("code").maybeSingle();if(e)throw e;if(!updated)return reply({error:"Someone just joined this room. Try another room."},409);
   return reply({room:code,token:secret});
  }
  const secret=String(b.token||"");if(secret.length<40)return reply({error:"Session token required."},401);
  const hash=await digest(secret),{data:r,error}=await db.from("word_wars_rooms").select("*").eq("code",code).gt("expires_at",new Date().toISOString()).maybeSingle();if(error)throw error;if(!r)return reply({error:"Room not found or expired."},404);
  const side=r.host_token_hash===hash?"host":r.guest_token_hash===hash?"guest":null;if(!side)return reply({error:"Invalid room session."},403);
  const ownWord=side==="host"?r.host_word:r.guest_word, theirWord=side==="host"?r.guest_word:r.host_word;
  const ownGuesses=(side==="host"?r.host_guesses:r.guest_guesses) as string[], theirGuesses=(side==="host"?r.guest_guesses:r.host_guesses) as string[];
  if(action==="set-word"){
   const w=String(b.word||"");if(!word(w,words))return reply({error:"Secret word must be a valid five-letter Wordle word."},400);if(ownWord)return reply({error:"Your secret word is already locked."},409);
   const field=side==="host"?"host_word":"guest_word";const{error:e}=await db.from("word_wars_rooms").update({[field]:w}).eq("code",code);if(e)throw e;return reply({ok:true});
  }
  if(action==="guess"){
   const w=String(b.word||"");if(!word(w,words))return reply({error:"Not a valid Wordle word. Please enter a real five-letter dictionary word."},400);if(!ownWord||!theirWord)return reply({error:"Both players must lock in their words first."},409);
   if(ownGuesses.length>=6)return reply({error:"No attempts remaining."},409);if(ownGuesses.includes(w))return reply({error:"You already tried that word."},409);
   const field=side==="host"?"host_guesses":"guest_guesses";const{error:e}=await db.from("word_wars_rooms").update({[field]:[...ownGuesses,w]}).eq("code",code);if(e)throw e;return reply({ok:true});
  }
  if(action==="state"){
   const won=!!theirWord&&ownGuesses.includes(theirWord), opponentSolved=!!ownWord&&theirGuesses.includes(ownWord), finished=won||opponentSolved||ownGuesses.length>=6||theirGuesses.length>=6;
   return reply({side,opponentName:side==="host"?r.guest_name:r.host_name,myWordSet:!!ownWord,opponentWordSet:!!theirWord,guesses:theirWord?ownGuesses.map(g=>({word:g,tiles:score(g,theirWord)})):[],opponentGuesses:ownWord?theirGuesses.map(g=>({word:g,tiles:score(g,ownWord)})):[],opponentAttempts:theirGuesses.length,opponentSolved,finished,won,opponentWord:finished?theirWord:null});
  }
  return reply({error:"Unknown action."},400);
 } catch(e) { console.error(e); return reply({error:"Server error. Please try again."},500); }
});