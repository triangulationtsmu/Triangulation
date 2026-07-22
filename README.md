# Triangulation — TSMU კლინიკური შეფასების სისტემა

ტრიანგულაციური მოდელი სამედიცინო სტუდენტების სამუშაო სივრცეზე დაფუძნებული
შეფასებისთვის (**Mini-CEX, CBD, DOPS, MSF**), შემაჯამებელი ანგარიშებით
(**WBA Summary, MSF Resume**) და სასწავლო გარემოს **ანონიმური UCEEM** შეფასებით.

არსებული HTML ფორმები, კითხვები, სკალები, ქულების ფორმულები, რადარული
დიაგრამები და ქართული ტექსტები **უცვლელადაა** შენარჩუნებული; დამატებულია
ავტორიზაცია, მონაცემთა ბაზა და როლებზე დაფუძნებული UI.

> **არქიტექტურა:** სრულად client-side (Vanilla JS + Firebase Firestore).
> **Firebase Auth-ის და Cloud Functions-ის გარეშე** — მუშაობს Firebase-ის
> **უფასო (Spark)** გეგმაზე. მომხმარებლები იქმნება Firestore-ში; პაროლი
> ინახება salted **SHA-256** hash-ად (არა ღია ტექსტად).

---

## 1. ტექნოლოგიები

| ფენა | ტექნოლოგია |
|------|-----------|
| Frontend | Vanilla HTML / CSS / JavaScript (ES Modules), Firebase Web SDK v10 (CDN) |
| Auth | App-level (username + password, Firestore + salted SHA-256) |
| DB | Cloud Firestore (უფასო Spark გეგმა) |
| Hosting | GitHub Pages (`/docs`) ან Firebase Hosting |

---

## 2. სტრუქტურა

```
Triangulation/
├── docs/                        # Frontend (GitHub Pages root)
│   ├── index.html               # კონსოლი standalone ინსტრუმენტების ღილაკებით
│   ├── admin.html               # აპლიკაცია (login + dashboard SPA)
│   ├── uceem.html               # საჯარო ანონიმური UCEEM ფორმა
│   ├── css/app.css
│   └── js/
│       ├── config.js            # Firebase public web config
│       ├── firebase.js          # Firestore init + password hashing helpers
│       ├── api.js               # client-side auth + Firestore CRUD
│       ├── ui.js                # toast / modal / confirm
│       ├── engines.js           # შენარჩუნებული ფორმულები (WBA/MSF/UCEEM/ფორმები)
│       ├── app.js               # session gate, router, ყველა view
│       └── uceem-public.js      # საჯარო UCEEM ფორმის ლოგიკა
├── firestore.rules              # Security Rules
├── firestore.indexes.json       # Composite indexes
├── firebase.json / .firebaserc  # Firebase config (hosting + firestore)
├── .env.example                 # public config-ის ნიმუში (build step არ არის)
├── package.json                 # deploy / serve scripts
└── README.md
```

---

## 3. მოთხოვნები

- ბრაუზერი (თანამედროვე). ლოკალური სერვერისთვის: **Node.js** (`npx serve`).
- Firestore-ის წესების ასატვირთად: **Firebase CLI** (`npm i -g firebase-tools`)
  — ან წესები ხელით Firebase Console-ში ჩასვი.
- **არ საჭიროებს**: Blaze გეგმას, Cloud Functions-ს, service-account key-ს,
  Google-ით შესვლას.

---

## 4. დაყენება (ერთჯერადი)

1. **Firestore ჩართვა**: Firebase Console → Build → Firestore Database →
   Create database.
2. **Security Rules** (აუცილებელი — თორემ აპლიკაცია ვერ წაიკითხავს/ჩაწერს):
   - **ვარიანტი A (CLI)**: `~/Triangulation`-დან
     ```bash
     firebase login
     npm run deploy:rules
     npm run deploy:indexes
     ```
   - **ვარიანტი B (Console)**: Firestore → Rules → ჩასვი `firestore.rules`-ის
     შიგთავსი → Publish. Indexes: Firestore → Indexes (ან პირველ query-ზე
     Console თავად შემოგთავაზებს ბმულით შექმნას).
3. **web config**: `docs/js/config.js` უკვე შევსებულია `triangulation-6c04e`-ით.
   სხვა პროექტისთვის შეცვალე იქ.

> ⚠️ საწყისი ადმინის seed **ავტომატურია** — აპლიკაციის პირველ გახსნაზე, თუ
> `kakha` არ არსებობს, ავტომატურად იქმნება (იხ. §6). ცალკე სკრიპტი არ საჭიროა.

---

## 5. Deployment (GitHub Pages)

1. Repo → **Settings → Pages → Deploy from a branch**
2. Branch: `main`, folder: **`/docs`** → Save.
3. საიტი: `https://triangulationtsmu.github.io/Triangulation/`
   ადმინისტრირების პანელი: `https://triangulationtsmu.github.io/Triangulation/admin.html`
   UCEEM საჯარო ბმული: `.../Triangulation/uceem.html?c=<campaignId>`

**ალტერნატივა — Firebase Hosting:** `firebase deploy --only hosting`
(public = `docs`).

---

## 6. საწყისი ადმინისტრატორი (ავტომატური)

აპლიკაციის პირველ ჩატვირთვაზე, თუ ბაზაში ჯერ არ არსებობს, ავტომატურად იქმნება:

```
სახელი: კახაბერ   გვარი: ჭერლიძე
username: kakha    password: 1234
role: department_head   isAdmin: true
```

idempotent — თუ უკვე არსებობს, დუბლიკატი არ იქმნება. პაროლი ბაზაში ინახება
მხოლოდ salted SHA-256 hash-ად (`credentials/{uid}`), არასდროს ღია ტექსტად.

> ეს ავტომ. seed მუშაობს მხოლოდ მას შემდეგ, რაც §4-ის Security Rules გამოქვეყნდება.

---

## 7. მონაცემთა მოდელი (Firestore)

```
departments/{id}     name, code, active, createdBy, createdAt, updatedAt
users/{uid}          uid, username, normalizedUsername, firstName, lastName,
                     role, isAdmin, departmentId, active, createdAt, updatedAt   (პაროლის გარეშე)
credentials/{uid}    salt, passwordHash (SHA-256), passwordUpdatedAt
usernameIndex/{norm} uid, username                       (უნიკალურობა + lookup)
students/{id}        firstName, lastName, phone, group, semester, course,
                     isShechrili(bool), academicYear, departmentId, groupId,
                     groupArchived, email, englishName, ...
studentGroups/{id}   name, departmentId, academicYear, semester, course, group,
                     specialty, isShechrili, archived, studentCount, ...
evaluations/{id}     studentId, type(mini_cex|cbd|dops|msf), departmentId, group,
                     semester, course, academicYear, evaluatorUid,
                     evaluatorFirstName/LastName/Role, answers, scores, summary
uceemCampaigns/{id}  title, departmentId, academicYear, semester, group,
                     targets[{userId,name,role}], publicKey, active, ...
uceemResponses/{id}  anonymousResponseId, campaignId, targetUserId, targetRole,
                     departmentId, academicYear, semester, group, answers,
                     calculatedScores, createdAt      (respondent-ის ვინაობა არ ინახება)
```

---

## 8. გამოყენება

- **ახალი მომხმარებელი**: ადმინი → *მომხმარებლები* → *+ ახალი მომხმარებელი*.
- **დეპარტამენტი**: *დეპარტამენტები* → დასახელება (+ კოდი) → დამატება.
- **სტუდენტი**: *სტუდენტები* → *+ სტუდენტის დამატება*. ფილტრი: სახელი/გვარი/
  ტელეფონი/ჯგუფი/სემესტრი/კურსი/სასწ. წელი/შეჭრილია/დეპარტამენტი.
- **ჯგუფის PDF-ით დამატება**: ადმინი → *სტუდენტები* →
  *ჯგუფის დამატება PDF-ით*. აირჩიე დეპარტამენტი, სასწავლო წელი
  (`2026(შ) - 2026`, `2026 - 2027`, ...), PDF ფაილი და შეამოწმე preview.
  იმპორტი ქმნის `studentGroups` ჩანაწერს და ყველა სტუდენტს აბამს ამ ჯგუფს.
- **ჯგუფის დაარქივება/წაშლა**: მხოლოდ ადმინს შეუძლია. დაარქივებული ჯგუფის
  სტუდენტები სამუშაო სივრცესა და სტუდენტების სიაში აღარ ჩანს; წაშლა შლის
  ჯგუფს და ამ ჯგუფით იმპორტირებულ სტუდენტებს.
- **შეფასება**: *სამუშაო სივრცე* → დეპარტამენტი → (წელი/სემესტრი) → ჯგუფი →
  სტუდენტის გასწვრივ **Mini-CEX / CBD / DOPS / MSF / WBA Summary / MSF Resume**.
  `kakha` account-ზე შემფასებელი ავტომატურად ივსება კახაბერ ჭერლიძით; სხვა
  shared role account-ებზე შემფასებელი შეფასების ფორმაში ხელით წერს საკუთარ
  სახელს და გვარს.
- **UCEEM კამპანია**: *UCEEM კამპანიები* → კონტექსტი + შესაფასებელი თანამშრომლები.
- **ანონიმური ბმული**: კამპანიის სტრიქონში **UCEEM ლინკის კოპირება**. ახალი
  კამპანიების ბმული შეიცავს დამატებით `publicKey`-ს; მხოლოდ `campaignId`-ით
  საჯარო გვერდი არაფერს აჩვენებს.
- **UCEEM შედეგები**: *UCEEM შედეგები* — აგრეგირებული, ანონიმური, ფილტრებით.
- **პაროლი**: *პროფილი* → საკუთარი პაროლის შეცვლა; ადმინი → *მომხმარებლები* →
  „პაროლის აღდგენა".

---

## 9. უსაფრთხოების მოდელი (მნიშვნელოვანი)

ეს build **მარტივი client-side მოდელია** უფასო გეგმისთვის:

- ✅ პაროლი არასდროს ინახება ღია ტექსტად (salted SHA-256).
- ✅ შემფასებლის ვინაობა ავტორიზებული პროფილიდან იწერება, არა ხელით.
- ✅ UCEEM პასუხი respondent-ის ვინაობის გარეშე ინახება; rules კრძალავს
  იდენტიფიცირებელ ველებს.
- ✅ UCEEM საჯარო გვერდი აღარ ხსნის კამპანიას მხოლოდ `campaignId`-ით; საჭიროა
  იმავე ბმულში არსებული `publicKey`.
- ⚠️ **მაგრამ** Firebase Auth-ის გარეშე, Firestore ვერ ამოწმებს ვინაობას
  server-დონეზე — ვინც public web config-ს ფლობს, პრინციპში მონაცემებთან
  წვდომა აქვს. RBAC უზრუნველყოფილია **აპლიკაციის დონეზე**.
- 🔒 თუ საჭიროა უფრო ძლიერი დაცვა (server-side hashing, custom token,
  Firestore rules-ის ნამდვილი enforcement), საჭიროა Firebase Auth /
  Cloud Functions build (Blaze გეგმა).

---

## 10. რა არ უნდა აიტვირთოს GitHub-ზე

`.gitignore` ფარავს: `node_modules/`, `.env`, ნებისმიერი service-account /
key ფაილი. public web config (`docs/js/config.js`) უსაფრთხოა და საჯაროა.

---

## 11. ლოკალური გაშვება

```bash
npm run serve            # http://localhost:3050 (docs/)
```

> ლოკალურადაც რეალურ Firestore-თან უკავშირდება (config.js-ის მიხედვით),
> ამიტომ §4-ის Security Rules გამოქვეყნებული უნდა იყოს.
