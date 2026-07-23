// Ebola/RDC — rattrapage d'un retard de 4 jours (299 cas, 139 décès).
// Repéré via le post LinkedIn de Dr Jean Kaseya (DG Africa CDC, 21/07) annonçant
// 900 décès et plus de 2400 cas confirmés, chiffres nettement au-dessus de la base.
// Cause : le run sync-ecdc-threats du 21/07 09:01 UTC a eu lieu AVANT le déploiement
// du fix de matcher 95e2db0 (Ready ~10h00 UTC), donc les chiffres ECDC du 18/07 sont
// partis sur la ligne fantôme Congo/RoC (désactivée) au lieu de la vraie ligne RDC,
// qui est restée figée au 15/07. Cf. project_ebola_congo_roc_phantom_substring_fixed_2026_07_21.
// source_priority laissé à 5 (PAS de verrou à 10) conformément à l'arbitrage de David
// du 16/07 : cf. project_ebola_drc_priority10_frozen_no_autofeed_2026_07_16.
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local.live','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const ID = 'bd1c3a46-a921-49b7-b79e-10ad715c4c38'
const SRC = 'https://www.ecdc.europa.eu/en/ebola-outbreak-democratic-republic-congo-and-uganda'

const description = "Ebola disease caused by Bundibugyo virus in the Democratic Republic of the Congo. ECDC outbreak page (last updated 21 July 2026): 2,423 confirmed cases and 967 deaths as of 19 July 2026, with 469 recovered and 734 patients hospitalised in isolation. Declared a Public Health Emergency of International Concern (PHEIC) on 17 May 2026."

const { data: before } = await sb.from('outbreaks').select('cases,deaths,recovered,date,source,source_priority,active').eq('id', ID).single()
console.log('AVANT :', JSON.stringify(before))

// Garde anti-régression : ne jamais écrire des chiffres inférieurs à ceux en base.
if (2423 < before.cases || 967 < before.deaths) { console.error('REFUS : régression détectée'); process.exit(1) }

const { data: after, error } = await sb.from('outbreaks').update({
  cases: 2423, deaths: 967, recovered: 469, date: '2026-07-19',
  source: SRC, description,
  description_fr: null, description_es: null, description_ar: null, description_id: null,
}).eq('id', ID).lte('source_priority', 5).select('cases,deaths,recovered,date,source_priority,active')

if (error) { console.error('ERREUR', error); process.exit(1) }
if (!after || after.length === 0) { console.error('BLOQUE par la garde source_priority'); process.exit(1) }
console.log('APRES :', JSON.stringify(after[0]))
