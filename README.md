# Triangulation — TSMU კლინიკური შეფასების სისტემა

ტრიანგულაციური მოდელი სამედიცინო სტუდენტების სამუშაო სივრცეზე დაფუძნებული
შეფასებისთვის (**Mini-CEX, CBD, DOPS, MSF**), მათი შემაჯამებელი ანგარიშებით
(**WBA Summary, MSF Resume**) და სასწავლო გარემოს **ანონიმური UCEEM** შეფასებით.

არსებული HTML ფორმები, კითხვები, სკალები, ქულების გამოთვლის ფორმულები,
რადარული დიაგრამები და ქართული ტექსტები **უცვლელად** არის შენარჩუნებული;
დამატებულია Firebase-ზე დაფუძნებული ავტორიზაცია, მონაცემთა ბაზა, უსაფრთხოების
წესები და როლებზე დაფუძნებული წვდომა.

---

## 1. ტექნოლოგიები

| ფენა | ტექნოლოგია |
|------|-----------|
| Frontend | Vanilla HTML / CSS / JavaScript (ES Modules), Firebase Web SDK v10 (CDN) |
| Auth | Firebase **Custom Authentication** (username + password, server-side bcrypt) |
| DB | Cloud Firestore |
| Backend | Cloud Functions (2nd gen, Node 20) |
| Security | Firestore Security Rules + Cloud Function claim checks |
| Hosting | GitHub Pages (`/docs`) ან Firebase Hosting |

---

## 2. პროექტის სტრუქტურა

```
Triangulation/
├── docs/                        # Frontend (GitHub Pages root)
│   ├── index.html               # აპლიკაცია (login + dashboard, ერთ SPA-ში)
│   ├── uceem.html               # საჯარო ანონიმური UCEEM ფორმა
│   ├── css/app.css
│   └── js/
│       ├── config.js            # Firebase public web config
│       ├── firebase.js          # SDK init (auth, firestore, functions)
│       ├── api.js               # Firestore CRUD + callable wrappers
│       ├── ui.js                # toast / modal / confirm helpers
│       ├── engines.js           # შენარჩუნებული ფორმულები (WBA/MSF/UCEEM/ფორმები)
│       ├── app.js               # auth gate, router, ყველა view
│       └── uceem-public.js      # საჯარო UCEEM ფორმის ლოგიკა
├── functions/
│   ├── index.js                 # login, adminCreateUser, adminResetPassword,
│   │                            # adminSetUserActive, changeOwnPassword, submitUceem
│   └── package.json
├── scripts/
│   └── seedAdmin.js             # საწყისი ადმინის idempotent seed
├── firestore.rules              # Security Rules
├── firestore.indexes.json       # Composite indexes
├── firebase.json / .firebaserc  # Firebase config
├── .env.example                 # environment ნიმუში
├── package.json                 # root scripts (seed, deploy)
└── README.md
```

---

## 3. მოთხოვნები

- **Node.js ≥ 20**, npm ≥ 10
- **Firebase CLI**: `npm install -g firebase-tools` (≥ 13)
- Firebase პროექტი **Blaze (pay-as-you-go)** გეგმაზე (Cloud Functions-ისთვის).

---

## 4. Firebase-ის დაყენება (ერთჯერადი)

1. **პროექტი**: გამოიყენება არსებული `triangulation-6c04e`
   (`.firebaserc`-ში მითითებული). ახალი პროექტისთვის შეცვალეთ `.firebaserc`
   და `docs/js/config.js` + `.env`.
2. **Web config**: `docs/js/config.js`-ში ჩასვით პროექტის public web config
   (Firebase Console → Project settings → Your apps). იგივე მნიშვნელობები
   `.env`-შიც (`.env.example`-დან).
3. **Firestore ჩართვა**: Console → Build → Firestore Database → Create database
   (production mode).
4. **Authentication**: Console → Build → Authentication → Get started →
   ჩართეთ **Anonymous**-ის ნაცვლად **Custom** მუშაობს ავტომატურად
   (Custom tokens ცალკე ჩართვას არ საჭიროებს). **Authorized domains**-ში
   დაამატეთ თქვენი GitHub Pages დომენი (მაგ., `triangulationtsmu.github.io`)
   და `localhost`.
5. **Billing**: ჩართეთ **Blaze** გეგმა (Functions-ისთვის აუცილებელია).

---

## 5. Deployment

```bash
# 1) დამოკიდებულებები
npm install                 # root (seed script-ისთვის)
cd functions && npm install && cd ..

# 2) Firebase-ში შესვლა
firebase login

# 3) Security Rules
npm run deploy:rules

# 4) Firestore indexes
npm run deploy:indexes

# 5) Cloud Functions
npm run deploy:functions
# (ან სამივე ერთად:)
npm run deploy:all

# 6) საწყისი ადმინისტრატორის seed (იხ. ქვემოთ)
npm run seed:admin
```

### GitHub Pages deployment
- Repo → **Settings → Pages → Build and deployment → Deploy from a branch**
- Branch: `main`, folder: **`/docs`** → Save.
- საიტი გამოქვეყნდება: `https://triangulationtsmu.github.io/Triangulation/`
- UCEEM საჯარო ბმული: `.../Triangulation/uceem.html?c=<campaignId>`

### (ალტერნატივა) Firebase Hosting
```bash
firebase deploy --only hosting     # public = docs (firebase.json-ში)
```

---

## 6. საწყისი ადმინისტრატორის seed

`npm run seed:admin` ქმნის (idempotent — დუბლიკატს არ ქმნის):

```
სახელი: კახაბერ   გვარი: ჭერლიძე
username: kakha    password: 1234
role: department_head   isAdmin: true
```

**საჭირო credentials**: Admin SDK-ს სჭირდება service-account.
Firebase Console → Project settings → **Service accounts** → *Generate new
private key* → შეინახეთ `service-account.json` (repo-ს **გარეთ** ან
`.gitignore`-ით დაცულ ადგილას) და მიუთითეთ:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
npm run seed:admin
```

> ⚠️ service-account JSON **არასოდეს** დააკომიტოთ — `.gitignore`-ში უკვე დაცულია.
> პაროლის hash ინახება მხოლოდ `privateCredentials/{uid}`-ში (bcrypt), არასოდეს
> user profile-ში და არასოდეს frontend-ში.

---

## 7. Environment variables

`.env` (იხ. `.env.example`):
- `FIREBASE_*` — public web config (frontend-შიც `docs/js/config.js`).
- `GOOGLE_APPLICATION_CREDENTIALS` — service-account JSON-ის გზა (seed-ისთვის).
- `SEED_ADMIN_*` — საწყისი ადმინის მონაცემები (default = მოთხოვნილი მნიშვნელობები).

Cloud Functions **არ** ინახავს custom secrets ამ ვერსიაში (bcrypt სრულად
Functions-შია). თუ დაგჭირდებათ საიდუმლოები — გამოიყენეთ
`firebase functions:secrets:set`.

---

## 8. რა არ უნდა აიტვირთოს GitHub-ზე

`.gitignore` ფარავს: `node_modules/`, `.env`, ნებისმიერი
`*serviceAccount*.json` / `firebase-adminsdk*.json` / `service-account*.json`,
Firebase debug ლოგები. **service account key არასოდეს დააკომიტოთ.**

---

## 9. მონაცემთა მოდელი (Firestore)

```
departments/{id}         name, code, active, createdBy, createdAt, updatedAt
users/{uid}              uid, username, normalizedUsername, firstName, lastName,
                         role, isAdmin, departmentId, active, createdAt, updatedAt
usernameIndex/{norm}     uid, username           (უნიკალურობა; admin-only read)
privateCredentials/{uid} passwordHash, ...        (client-ს სრულად დახურული)
students/{id}            firstName, lastName, phone, group, semester, course,
                         isShechrili, academicYear, departmentId, ...
evaluations/{id}         studentId, type(mini_cex|cbd|dops|msf), departmentId,
                         group, semester, course, academicYear, evaluatorUid,
                         evaluatorFirstName/LastName/Role, answers, scores, summary
uceemCampaigns/{id}      title, departmentId, academicYear, semester, group,
                         targets[{userId,name,role}], active, ...
uceemResponses/{id}      anonymousResponseId, campaignId, targetUserId, targetRole,
                         departmentId, academicYear, semester, group, answers,
                         calculatedScores, createdAt   (respondent-ის ვინაობა არ ინახება)
```

---

## 10. გამოყენების ინსტრუქცია

- **ახალი მომხმარებელი**: შესვლა ადმინად → *მომხმარებლები* → *+ ახალი
  მომხმარებელი* (username, პაროლი, სახელი, გვარი, როლი, დეპარტამენტი, აქტიურობა).
- **დეპარტამენტი**: *დეპარტამენტები* → დასახელება (+ კოდი) → დამატება.
- **სტუდენტი**: *სტუდენტები* → *+ სტუდენტის დამატება* (ყველა სავალდებულო ველი).
  ფილტრი: სახელი/გვარი/ტელეფონი/ჯგუფი/სემესტრი/კურსი/სასწ. წელი/შეჭრილია/დეპ.
- **შეფასება**: *სამუშაო სივრცე* → დეპარტამენტი → (წელი/სემესტრი) → ჯგუფი →
  სტუდენტის გასწვრივ **Mini-CEX / CBD / DOPS / MSF / WBA Summary / MSF Resume**.
  შემფასებელი ავტომატურად ივსება ავტორიზებული პროფილიდან.
- **UCEEM კამპანია**: *UCEEM კამპანიები* → დეპ./წელი/სემესტრი/ჯგუფი + შესაფასებელი
  თანამშრომლები → შექმნა.
- **ანონიმური ბმულის კოპირება**: კამპანიის სტრიქონში **UCEEM ლინკის კოპირება**
  (ან სამუშაო სივრცის ადმინ ღილაკი). ბმული იხსნება ავტორიზაციის გარეშე.
- **UCEEM შედეგები**: *UCEEM შედეგები* — აგრეგირებული, ანონიმური, ფილტრებით.

---

## 11. უსაფრთხოება (მოკლედ)

- პაროლები — მხოლოდ bcrypt hash `privateCredentials`-ში; შემოწმება მხოლოდ
  server-side (`login` function). წარმატებისას იცემა Firebase custom token
  claims-ით (`isAdmin`, `role`, `departmentId`).
- `privateCredentials` — client-ისთვის სრულად დახურული.
- მომხმარებელთა შექმნა/პაროლის აღდგენა/გათიშვა — მხოლოდ ადმინ Cloud Functions-ით.
- `evaluatorUid` client-იდან ვერ გაყალბდება (rules ამოწმებს `== request.auth.uid`).
- UCEEM პასუხი — მხოლოდ `submitUceem` function წერს (client წვდომა დახურული);
  respondent-ის ვინაობა/UID/IP/user-agent **არ** ინახება.
- გათიშული მომხმარებელი ვერ შედის; გათიშვისას refresh tokens უქმდება.

---

## 12. ლოკალური გაშვება

```bash
# frontend სტატიკურად
npm run serve            # http://localhost:3000 (docs/)

# სრული სტეკი ემულატორებით (optional)
firebase emulators:start
```

> ლოკალურად login/callable-ების სამუშაოდ საჭიროა deploy-ული Functions ან
> ემულატორები + `docs/js/config.js`-ის ემულატორზე მიმართვა.
