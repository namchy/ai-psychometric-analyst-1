#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

: "${LOCAL_DEMO_HR_PASSWORD:?Missing required env var: LOCAL_DEMO_HR_PASSWORD}"
: "${LOCAL_DEMO_CANDIDATE_PASSWORD:?Missing required env var: LOCAL_DEMO_CANDIDATE_PASSWORD}"

run_node() {
  node --env-file=.env.local -e "$1"
}

run_node_retry() {
  local code="$1"
  local attempt=1
  local max_attempts=10
  local output

  while true; do
    if output="$(run_node "$code" 2>&1)"; then
      printf '%s' "$output"
      return 0
    fi

    if [ "$attempt" -ge "$max_attempts" ]; then
      printf '%s\n' "$output" >&2
      return 1
    fi

    printf 'Retrying transient bootstrap node command (attempt %s).\n' "$attempt" >&2
    attempt=$((attempt + 1))
    sleep 0.5
  done
}

DEMO_ORGANIZATION_SLUG="xonix"
DEMO_ORGANIZATION_NAME="Xonix"
DEMO_HR_EMAIL="hr1@nesto.com"
DEMO_CANDIDATE_EMAIL="user1@nesto.com"
DEMO_CANDIDATE_FULL_NAME="User 1"

ORG_ID="$(run_node_retry 'const {createClient}=require("@supabase/supabase-js"); const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}}); (async()=>{const {data,error}=await s.from("organizations").select("id").eq("slug","xonix").maybeSingle(); if(error) throw new Error(error.message); console.log(data?.id ?? "");})().catch((e)=>{console.error(e.message); process.exit(1);});')"
ORG_ACTION="reused"

if [ -n "$ORG_ID" ]; then
  ORG_ID="$(run_node_retry 'const {createClient}=require("@supabase/supabase-js"); const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}}); (async()=>{const {data,error}=await s.from("organizations").update({name:"Xonix",status:"active"}).eq("id","'"$ORG_ID"'").select("id").single(); if(error) throw new Error(error.message); console.log(data.id);})().catch((e)=>{console.error(e.message); process.exit(1);});')"
else
  ORG_ACTION="created"
  ORG_ID="$(run_node_retry 'const {createClient}=require("@supabase/supabase-js"); const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}}); (async()=>{const {data,error}=await s.from("organizations").insert({slug:"xonix",name:"Xonix",status:"active"}).select("id").single(); if(error) throw new Error(error.message); console.log(data.id);})().catch((e)=>{console.error(e.message); process.exit(1);});')"
fi

HR_USER_ID="$(run_node_retry 'const {createClient}=require("@supabase/supabase-js"); const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}}); s.auth.admin.listUsers({page:1,perPage:200}).then(({data,error})=>{if(error) throw new Error(error.message); const user=data.users.find((entry)=>entry.email?.toLowerCase()==="hr1@nesto.com"); console.log(user?.id ?? "");}).catch((e)=>{console.error(e.message); process.exit(1);});')"
HR_USER_ACTION="reused"

if [ -n "$HR_USER_ID" ]; then
  HR_USER_ID="$(run_node_retry 'const {createClient}=require("@supabase/supabase-js"); const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}}); s.auth.admin.updateUserById("'"$HR_USER_ID"'",{email_confirm:true,password:process.env.LOCAL_DEMO_HR_PASSWORD}).then(({data,error})=>{if(error) throw new Error(error.message); console.log(data.user.id);}).catch((e)=>{console.error(e.message); process.exit(1);});')"
else
  HR_USER_ACTION="created"
  HR_USER_ID="$(run_node_retry 'const {createClient}=require("@supabase/supabase-js"); const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}}); s.auth.admin.createUser({email:"hr1@nesto.com",password:process.env.LOCAL_DEMO_HR_PASSWORD,email_confirm:true}).then(({data,error})=>{if(error) throw new Error(error.message); console.log(data.user.id);}).catch((e)=>{console.error(e.message); process.exit(1);});')"
fi

CANDIDATE_USER_ID="$(run_node_retry 'const {createClient}=require("@supabase/supabase-js"); const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}}); s.auth.admin.listUsers({page:1,perPage:200}).then(({data,error})=>{if(error) throw new Error(error.message); const user=data.users.find((entry)=>entry.email?.toLowerCase()==="user1@nesto.com"); console.log(user?.id ?? "");}).catch((e)=>{console.error(e.message); process.exit(1);});')"
CANDIDATE_USER_ACTION="reused"

if [ -n "$CANDIDATE_USER_ID" ]; then
  CANDIDATE_USER_ID="$(run_node_retry 'const {createClient}=require("@supabase/supabase-js"); const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}}); s.auth.admin.updateUserById("'"$CANDIDATE_USER_ID"'",{email_confirm:true,password:process.env.LOCAL_DEMO_CANDIDATE_PASSWORD}).then(({data,error})=>{if(error) throw new Error(error.message); console.log(data.user.id);}).catch((e)=>{console.error(e.message); process.exit(1);});')"
else
  CANDIDATE_USER_ACTION="created"
  CANDIDATE_USER_ID="$(run_node_retry 'const {createClient}=require("@supabase/supabase-js"); const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}}); s.auth.admin.createUser({email:"user1@nesto.com",password:process.env.LOCAL_DEMO_CANDIDATE_PASSWORD,email_confirm:true}).then(({data,error})=>{if(error) throw new Error(error.message); console.log(data.user.id);}).catch((e)=>{console.error(e.message); process.exit(1);});')"
fi

MEMBERSHIP_ID="$(run_node_retry 'const {createClient}=require("@supabase/supabase-js"); const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}}); (async()=>{const {data,error}=await s.from("organization_memberships").select("id").eq("organization_id","'"$ORG_ID"'").eq("user_id","'"$HR_USER_ID"'").maybeSingle(); if(error) throw new Error(error.message); console.log(data?.id ?? "");})().catch((e)=>{console.error(e.message); process.exit(1);});')"
MEMBERSHIP_ACTION="reused"

if [ -n "$MEMBERSHIP_ID" ]; then
  MEMBERSHIP_ID="$(run_node_retry 'const {createClient}=require("@supabase/supabase-js"); const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}}); (async()=>{const {data,error}=await s.from("organization_memberships").update({role:"hr_admin",status:"active"}).eq("id","'"$MEMBERSHIP_ID"'").select("id").single(); if(error) throw new Error(error.message); console.log(data.id);})().catch((e)=>{console.error(e.message); process.exit(1);});')"
else
  MEMBERSHIP_ACTION="created"
  MEMBERSHIP_ID="$(run_node_retry 'const {createClient}=require("@supabase/supabase-js"); const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}}); (async()=>{const {data,error}=await s.from("organization_memberships").insert({organization_id:"'"$ORG_ID"'",user_id:"'"$HR_USER_ID"'",role:"hr_admin",status:"active"}).select("id").single(); if(error) throw new Error(error.message); console.log(data.id);})().catch((e)=>{console.error(e.message); process.exit(1);});')"
fi

PARTICIPANT_ID="$(run_node_retry 'const {createClient}=require("@supabase/supabase-js"); const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}}); (async()=>{const {data,error}=await s.from("participants").select("id").eq("user_id","'"$CANDIDATE_USER_ID"'").order("created_at",{ascending:true}).limit(1); if(error) throw new Error(error.message); console.log(data?.[0]?.id ?? "");})().catch((e)=>{console.error(e.message); process.exit(1);});')"

if [ -n "$PARTICIPANT_ID" ]; then
  PARTICIPANT_CONFLICT_ID="$(run_node_retry 'const {createClient}=require("@supabase/supabase-js"); const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}}); (async()=>{const {data,error}=await s.from("participants").select("id").eq("organization_id","'"$ORG_ID"'").ilike("email","user1@nesto.com").neq("id","'"$PARTICIPANT_ID"'").limit(1); if(error) throw new Error(error.message); console.log(data?.[0]?.id ?? "");})().catch((e)=>{console.error(e.message); process.exit(1);});')"
  if [ -n "$PARTICIPANT_CONFLICT_ID" ]; then
    echo "Participant normalization would conflict with existing participant $PARTICIPANT_CONFLICT_ID in organization $ORG_ID." >&2
    exit 1
  fi
  PARTICIPANT_ACTION="reused"
else
  PARTICIPANT_ID="$(run_node_retry 'const {createClient}=require("@supabase/supabase-js"); const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}}); (async()=>{const {data,error}=await s.from("participants").select("id").eq("organization_id","'"$ORG_ID"'").ilike("email","user1@nesto.com").order("created_at",{ascending:true}).limit(1); if(error) throw new Error(error.message); console.log(data?.[0]?.id ?? "");})().catch((e)=>{console.error(e.message); process.exit(1);});')"
  PARTICIPANT_ACTION="reused"
fi

if [ -n "$PARTICIPANT_ID" ]; then
  PARTICIPANT_ID="$(run_node_retry 'const {createClient}=require("@supabase/supabase-js"); const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}}); (async()=>{const {data,error}=await s.from("participants").update({organization_id:"'"$ORG_ID"'",user_id:"'"$CANDIDATE_USER_ID"'",email:"user1@nesto.com",full_name:"User 1",participant_type:"candidate",status:"active"}).eq("id","'"$PARTICIPANT_ID"'").select("id").single(); if(error) throw new Error(error.message); console.log(data.id);})().catch((e)=>{console.error(e.message); process.exit(1);});')"
else
  PARTICIPANT_ACTION="created"
  PARTICIPANT_ID="$(run_node_retry 'const {createClient}=require("@supabase/supabase-js"); const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}}); (async()=>{const {data,error}=await s.from("participants").insert({organization_id:"'"$ORG_ID"'",user_id:"'"$CANDIDATE_USER_ID"'",email:"user1@nesto.com",full_name:"User 1",participant_type:"candidate",status:"active"}).select("id").single(); if(error) throw new Error(error.message); console.log(data.id);})().catch((e)=>{console.error(e.message); process.exit(1);});')"
fi

printf 'Local demo bootstrap complete.\n'
printf '{\n'
printf '  "organization": { "id": "%s", "slug": "%s", "action": "%s" },\n' "$ORG_ID" "$DEMO_ORGANIZATION_SLUG" "$ORG_ACTION"
printf '  "hrUser": { "id": "%s", "email": "%s", "action": "%s" },\n' "$HR_USER_ID" "$DEMO_HR_EMAIL" "$HR_USER_ACTION"
printf '  "candidateUser": { "id": "%s", "email": "%s", "action": "%s" },\n' "$CANDIDATE_USER_ID" "$DEMO_CANDIDATE_EMAIL" "$CANDIDATE_USER_ACTION"
printf '  "membership": { "id": "%s", "action": "%s" },\n' "$MEMBERSHIP_ID" "$MEMBERSHIP_ACTION"
printf '  "participant": { "id": "%s", "email": "%s", "full_name": "%s", "action": "%s" }\n' "$PARTICIPANT_ID" "$DEMO_CANDIDATE_EMAIL" "$DEMO_CANDIDATE_FULL_NAME" "$PARTICIPANT_ACTION"
printf '}\n'
