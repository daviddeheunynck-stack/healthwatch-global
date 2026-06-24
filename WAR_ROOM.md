# WAR ROOM — HealthWatch Global Launch Day

> Ouvrir ce fichier à 08h30 PDT le 25 juin. Garder ouvert pendant toute la journée.
> Accessible même si l'app est down : GitHub → fichier WAR_ROOM.md

---

## 1. URLs critiques — à ouvrir maintenant (onglets permanents)

| Priorité | Service | URL | Ce qu'on y cherche |
|---|---|---|---|
| 🔴 P1 | **Vercel Logs** | https://vercel.com/dashboard → healthwatch-global → Logs | Erreurs 500, timeouts, edge rejections |
| 🔴 P1 | **Sentry Issues** | https://sentry.io → Issues → filter: `is:unresolved` | Stack traces, volume d'erreurs, nouveaux events |
| 🔴 P1 | **Supabase Dashboard** | https://supabase.com/dashboard → healthwatch-global → Database | Connection pool, slow queries, erreurs RLS |
| 🟡 P2 | **PH Page Maker** | https://www.producthunt.com/posts/healthwatch-global → tes commentaires | Commentaires négatifs à traiter en < 5 min |
| 🟡 P2 | **Brevo Stats** | https://app.brevo.com → Campaigns → Transactional | Taux de délivrance emails, bounces |
| 🟢 P3 | **Vercel Analytics** | https://vercel.com/dashboard → healthwatch-global → Analytics | Trafic en temps réel, pages les plus visitées |

---

## 2. Diagnostic — séquence en cas d'incident

```
SYMPTÔME reçu (commentaire PH, DM, email)
    │
    ▼
1. Vercel Logs → cherche 500/502/503 avec timestamp
    │
    ├─ Si erreurs Supabase → aller à étape 3
    └─ Si erreurs Next.js → aller à Sentry
    │
    ▼
2. Sentry → filtre "last 30 min" → stack trace
    │
    ├─ Si erreur DB → étape 3
    ├─ Si erreur code → identifier le composant, rollback si besoin
    └─ Si erreur edge → vérifier Vercel Edge Function logs
    │
    ▼
3. Supabase → Database → Connection Pool
    - Pool utilisé > 80% ? → SCALE: Dashboard → Settings → Database → Pool size
    - Query lente ? → Dashboard → SQL Editor → "SELECT * FROM pg_stat_activity"
    │
    ▼
4. POST commentaire PH < 5 min (voir templates ci-dessous)
```

---

## 3. Templates — à copier-coller immédiatement

### Template A — Accusé de réception (< 5 min après premier signalement)

Réponse directe au commentaire public :
```
@[USERNAME] Thanks for flagging — we're on it right now. ETA fix ~[X] min.
Really appreciate the upvote regardless 🙏
```

### Template B — Commentaire maker épinglé (si incident > 2 commentaires)

```
**[Maker update — HH:MM PDT] [NOM_INCIDENT]**

We're seeing [DESCRIPTION courte] affecting ~[X]% of users.
Root cause: [1 phrase max].
Fix in progress — ETA [HH:MM PDT].

[FEATURE_FONCTIONNELLE] remains fully functional in the meantime.

Will update every 10 min until resolved.
— David
```

### Template C — Résolution

```
**[Maker update — HH:MM PDT] ✅ Resolved**

[NOM_INCIDENT] is fixed. Root cause was [1 phrase].
All features are fully operational.

Thanks for your patience — and for the upvotes despite the hiccup 🙏
— David
```

### Template D — Fact-check données (épidémiologiste compare WHO vs HWG)

```
@[USERNAME] Thanks for doing this — exactly the scrutiny this kind of tool needs.

Methodology note to make the comparison fair:

[DISEASE + COUNTRY]: WHO sitrep = [WHO_NUMBER] (lab-confirmed only).
HealthWatch = [HW_NUMBER] — confirmed + probable cases aggregated from
[WHO / Africa CDC / ECDC / PAHO]. The [DELTA]-case delta is the probable
case count from [SOURCE]'s [DATE] report.

We don't replace WHO sitrep. We display confirmed+probable (IHR Art. 9)
for early-warning visibility, before lab confirmation arrives.
Case definition is visible on hover (ⓘ Cases column header).

Happy to share source docs — DM.
```

---

## 4. Incidents les plus probables et leurs fixes

| Incident | Cause probable | Fix |
|---|---|---|
| Modal ne s'ouvre pas (500) | Supabase pool saturé | Augmenter pool size dans Supabase Dashboard |
| Page blanche | Build edge runtime error | Vérifier Sentry + Vercel logs, rollback si nécessaire |
| Lenteur générale (> 5s) | Cold start Vercel ou Supabase query lente | Rien à faire, s'améliore seul sous 2 min — commenter sur PH |
| Emails d'alerte non reçus | Brevo rate limit | Vérifier Brevo → queue ; les crons reprennent d'eux-mêmes |
| Signup cassé | Supabase Auth overload | Vérifier Supabase → Auth → Logs |
| Stripe checkout cassé | Rate limit ou webhook timeout | Vérifier Vercel → /api/stripe — pas critique pour le lancement |

---

## 5. Rollback — commande unique

```bash
# Voir les derniers déploiements
vercel ls

# Rollback au déploiement précédent (remplacer [URL_PREV])
vercel rollback [URL_PREV]
```

---

## 6. Règles du jour J

1. **Répondre en < 5 min** à tout commentaire négatif sur PH — pas une solution, un accusé de réception avec ETA
2. **Ne pas expliquer en détail** le problème technique en public — "scaling issue due to traffic volume" suffit
3. **Mettre à jour toutes les 10 min** si un incident maker comment est épinglé
4. **Poster "Resolved" dès que c'est corrigé** — la résolution rapide est elle-même du marketing
5. **Ne pas s'excuser trop** — "thanks for flagging" > "so sorry for the inconvenience"

---

## 7. Contacts d'urgence

- **Supabase support** : support.supabase.com (chat) — mentionner "production incident, PH launch"
- **Vercel support** : vercel.com/support — plan Pro requis pour support prioritaire
- **Sentry** : sentry.io (self-serve, pas de support direct)

---

## 8. Checklist pré-lancement (08h30 PDT = 17h30 Paris)

- [ ] Vérifier que le dernier déploiement Vercel est vert
- [ ] Ouvrir les 6 onglets de monitoring (section 1)
- [ ] Tester le flow signup → dashboard sur un compte test
- [ ] Tester l'ouverture d'un modal foyer
- [ ] Vérifier que le maker comment de lancement est prêt (voir content-log.md)
- [ ] Téléphone chargé à 100%
- [ ] Notifications PH activées sur le téléphone

---

*Dernière mise à jour : 24 juin 2026*
