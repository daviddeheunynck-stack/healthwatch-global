// Choléra/Tchad — réactivation + rechiffrage contre la source nationale.
// Signalé par Oumaima Mahamat Djarma (OMS Tchad) sur LinkedIn le 21/07 : l'épidémie
// de choléra en cours au Tchad n'apparaissait pas sur healthwatch-global.com.
// Ligne désactivée le 17/07 faute de chiffre (Tchad absent de l'Epi Update #38 de l'OMS,
// cf. project_cholera_don579_stale_rows_fixed_2026_07_17) ; le Tchad n'est pas couvert
// par CHOLERA_ISO3 de sync-who-regional, donc aucun cron ne l'alimente => verrou prio 10
// cohérent avec les 4 autres lignes du même lot (Congo, RDC, Soudan du Sud, Soudan).
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local.live','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const ID = '06541c4a-6b67-4c2c-a44e-818ba7621d76'
const SRC = 'https://tchadinfos.com/2026/07/02/cholera-dans-le-district-sanitaire-de-karal-129-cas-et-4-deces-les-autorites-renforcent-la-riposte/'

const description = "Cholera outbreak in the Karal health district, Hadjer-Lamis province, Chad. The Ministry of Public Health and Prevention confirmed the outbreak in June 2026 after detection of Vibrio cholerae O1 serotype Ogawa (16 cases and 1 death as of 16 June 2026). At the national response meeting of 1 July 2026, chaired by the Secretary of State for Public Health and Prevention, the Public Health Emergency Operations Centre (COUSP) reported 9 new cases, bringing the cumulative total to 129 cases and 4 deaths (2 community, 2 facility), a case fatality rate of 3.10%. Response measures include active case finding, deployment of cholera treatment kits, a joint multisectoral mission and disinfection of vehicles on the N'Djamena-Karal route. Chad does not appear in WHO's Multi-country Cholera Epidemiological Update #38 (30 June 2026, data as of 31 May 2026), so this outbreak is tracked from national authority reporting."

const { data: before } = await sb.from('outbreaks').select('cases,deaths,date,active,risk_level,source_priority,is_seed,verification_status,response_phase,source').eq('id', ID).single()
console.log('AVANT :', JSON.stringify(before))

const { data: after, error } = await sb.from('outbreaks').update({
  cases: 129,
  deaths: 4,
  date: '2026-07-01',
  active: true,
  risk_level: 'medium',
  verification_status: 'confirmed',
  response_phase: 'active_response',
  source: SRC,
  source_priority: 10,
  is_seed: false,
  description,
  description_fr: null, description_es: null, description_ar: null, description_id: null,
}).eq('id', ID).select('cases,deaths,date,active,risk_level,source_priority,is_seed,verification_status,response_phase,source,description_fr')

if (error) { console.error('ERREUR', error); process.exit(1) }
if (!after || after.length === 0) { console.error('BLOQUE : 0 ligne affectee'); process.exit(1) }
console.log('APRES :', JSON.stringify(after[0]))
