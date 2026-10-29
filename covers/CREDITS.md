# Cover photo library: credits

These are the cover photos for run cards in "בוא נרוץ". The app picks one by time of day and place (see `docs/design/ROUND17_PHOTO_COVERS.md` §1–§2). `catalog.json` is the machine-readable index.

**Version 2 (2026-10-29):** every photo shows running: runners in the scene, seen from afar, from behind or as silhouettes, plus some running details (shoes, legs, a track) in each group. The ids are the same as in version 1, so existing runs keep their slot and get the new photo; the apps load `?v=2` so a cached version-1 photo isn't shown.

**Licences:**
- Unsplash photos are under the [Unsplash License](https://unsplash.com/license): free to use, commercially or not, attribution appreciated but not required. Only free-licence photos were used (searched with `license=free`, no Unsplash+).
- Pexels photos are under the [Pexels License](https://www.pexels.com/license/): free to use, attribution not required. "Pexels" stands in where the photographer's name wasn't listed.
- Neither licence allows selling a photo unaltered or using the photos to build a competing photo service.

**Processing:** each photo was fetched from the source's image CDN cropped to 4:5 (1080×1350; `thumb/` holds 360×450 copies) and re-encoded to about 180 KB or less. A few very detailed photos are up to about 320 KB.

**Count:** 202 photos, at least 12 for each of the 16 time × place combinations.

| id | Time | Place | Photographer | Source | Licence |
|---|---|---|---|---|---|
| `sea-dawn-01` | dawn | sea | Sara Ruffoni | https://unsplash.com/photos/iiYbGXWqJY0 | Unsplash License |
| `sea-dawn-02` | dawn | sea | Sara Ruffoni | https://unsplash.com/photos/2DTLUjSP6zs | Unsplash License |
| `sea-dawn-03` | dawn | sea | Sara Ruffoni | https://unsplash.com/photos/jMGnZhJsysE | Unsplash License |
| `sea-dawn-04` | dawn | sea | Sara Ruffoni | https://unsplash.com/photos/7hrr541x8p0 | Unsplash License |
| `sea-dawn-05` | dawn | sea | Sara Ruffoni | https://unsplash.com/photos/At-pkCKB22o | Unsplash License |
| `sea-dawn-06` | dawn | sea | Maurice Nguyen | https://unsplash.com/photos/-yz_nxquyXQ | Unsplash License |
| `sea-dawn-07` | dawn | sea | Fedor | https://unsplash.com/photos/22iZ2OxoECY | Unsplash License |
| `sea-dawn-08` | dawn | sea | Gervyn Louis | https://unsplash.com/photos/mQxCgQvwBMY | Unsplash License |
| `sea-dawn-09` | dawn | sea | Julian Ostarek | https://unsplash.com/photos/H2wpC3kLVic | Unsplash License |
| `sea-dawn-10` | dawn | sea | Fito García | https://unsplash.com/photos/H1jj8iixXTE | Unsplash License |
| `sea-dawn-11` | dawn | sea | Josiah Weiss | https://unsplash.com/photos/3dCljt2Pud8 | Unsplash License |
| `sea-dawn-12` | dawn | sea | Thilina Alagiyawanna | https://unsplash.com/photos/9D3w5Fq-Q1g | Unsplash License |
| `sea-dawn-13` | dawn | sea | maks_d | https://unsplash.com/photos/yp765U5jG68 | Unsplash License |
| `sea-day-01` | day | sea | Mohammadreza Charkhgard | https://unsplash.com/photos/9PAxmjJpnVE | Unsplash License |
| `sea-day-02` | day | sea | Daniel Salcius | https://unsplash.com/photos/3VytcljdGCQ | Unsplash License |
| `sea-day-03` | day | sea | Jaclyn Moy | https://unsplash.com/photos/UN_T7yjOZDY | Unsplash License |
| `sea-day-04` | day | sea | Juli Kosolapova | https://unsplash.com/photos/zaMqmCc690Y | Unsplash License |
| `sea-day-05` | day | sea | Shaylyn | https://unsplash.com/photos/OYy81w7oMjU | Unsplash License |
| `sea-day-06` | day | sea | Unsplash | https://unsplash.com/photos/c59hEeerAaI | Unsplash License |
| `sea-day-07` | day | sea | Dulcey Lima | https://unsplash.com/photos/8Tx1FOj8xJc | Unsplash License |
| `sea-day-08` | day | sea | Oxana Melis | https://unsplash.com/photos/oct9XaNtLb0 | Unsplash License |
| `sea-day-09` | day | sea | Kate Trifo | https://unsplash.com/photos/jf_YIwWKg8Q | Unsplash License |
| `sea-day-10` | day | sea | Jules Kassas | https://unsplash.com/photos/acSUaFmCps0 | Unsplash License |
| `sea-day-11` | day | sea | Fatemeh Rezvani | https://unsplash.com/photos/nA6Ub0Gn5Uw | Unsplash License |
| `sea-day-12` | day | sea | Karlis Reimanis | https://unsplash.com/photos/-A0_mUBLqmU | Unsplash License |
| `sea-day-13` | day | sea | Liana S | https://unsplash.com/photos/diSKbHihOBk | Unsplash License |
| `sea-sunset-01` | sunset | sea | Esteban Bonilla | https://unsplash.com/photos/ZTKVUNgnmW8 | Unsplash License |
| `sea-sunset-02` | sunset | sea | sander traa | https://unsplash.com/photos/ERzX-pzsFNg | Unsplash License |
| `sea-sunset-03` | sunset | sea | Janylah Etienne | https://unsplash.com/photos/PYTL7By1m2U | Unsplash License |
| `sea-sunset-04` | sunset | sea | Harry Truong | https://unsplash.com/photos/LLqHmT6yYSI | Unsplash License |
| `sea-sunset-05` | sunset | sea | Yassin Nur Fadhilah | https://unsplash.com/photos/rs4Tefe2U0I | Unsplash License |
| `sea-sunset-06` | sunset | sea | Juanca Paulino | https://unsplash.com/photos/fCXDjmkmko8 | Unsplash License |
| `sea-sunset-07` | sunset | sea | Michele Palma | https://unsplash.com/photos/MyTb7FbJiFg | Unsplash License |
| `sea-sunset-08` | sunset | sea | Arun K | https://unsplash.com/photos/uSJd00cXC10 | Unsplash License |
| `sea-sunset-09` | sunset | sea | SwapnIl Dwivedi | https://unsplash.com/photos/Xcmfp0gBukI | Unsplash License |
| `sea-sunset-10` | sunset | sea | Huckster | https://unsplash.com/photos/V62UrdknDCA | Unsplash License |
| `sea-sunset-11` | sunset | sea | Klara Kulikova | https://unsplash.com/photos/f_3wlgpL6nA | Unsplash License |
| `sea-sunset-12` | sunset | sea | Anastasiya Badun | https://unsplash.com/photos/EbF44cX9PdI | Unsplash License |
| `sea-sunset-13` | sunset | sea | van asten maarten | https://unsplash.com/photos/5Z9ZClW3MYI | Unsplash License |
| `sea-night-01` | night | sea | gshguru | https://unsplash.com/photos/Z3TCqQkTQXU | Unsplash License |
| `sea-night-02` | night | sea | Babumon PT | https://unsplash.com/photos/loHC7omTI0I | Unsplash License |
| `sea-night-03` | night | sea | Milos Lopusina | https://unsplash.com/photos/vEARSCkDr9s | Unsplash License |
| `sea-night-04` | night | sea | Olha Vilkhova | https://unsplash.com/photos/UajOyN9yGBs | Unsplash License |
| `sea-night-05` | night | sea | Pana K | https://unsplash.com/photos/dLd6PM5CKK4 | Unsplash License |
| `sea-night-06` | night | sea | Oxana Melis | https://unsplash.com/photos/hr163btG_jU | Unsplash License |
| `sea-night-07` | night | sea | Pexels | https://www.pexels.com/photo/36732202/ | Pexels License |
| `sea-night-08` | night | sea | Pexels | https://www.pexels.com/photo/27854669/ | Pexels License |
| `sea-night-09` | night | sea | Duven | https://www.pexels.com/photo/12360284/ | Pexels License |
| `sea-night-10` | night | sea | Duc N | https://www.pexels.com/photo/32859211/ | Pexels License |
| `sea-night-11` | night | sea | Pexels | https://www.pexels.com/photo/36732197/ | Pexels License |
| `sea-night-12` | night | sea | Pexels | https://www.pexels.com/photo/36732196/ | Pexels License |
| `sea-night-13` | night | sea | Zebari Visuals | https://www.pexels.com/photo/37476348/ | Pexels License |
| `park-dawn-01` | dawn | park | Olek Buzunov | https://unsplash.com/photos/uUgHvjDU6y4 | Unsplash License |
| `park-dawn-02` | dawn | park | Florian Kurrasch | https://unsplash.com/photos/70shTdGaZQs | Unsplash License |
| `park-dawn-03` | dawn | park | Ben Kupke | https://unsplash.com/photos/DTLftzuUICk | Unsplash License |
| `park-dawn-04` | dawn | park | Eirik Skarstein | https://unsplash.com/photos/3Y2z_UNWnfE | Unsplash License |
| `park-dawn-05` | dawn | park | Bohdan Hyrovych | https://unsplash.com/photos/Z_Myd4DfKX0 | Unsplash License |
| `park-dawn-06` | dawn | park | Jorge Alberto Vega Barrera | https://unsplash.com/photos/1J6oEUhEWU4 | Unsplash License |
| `park-dawn-07` | dawn | park | Ben Hadfield | https://unsplash.com/photos/88radmUkRKA | Unsplash License |
| `park-dawn-08` | dawn | park | Michael Pointner | https://unsplash.com/photos/l95oMx3CHPo | Unsplash License |
| `park-dawn-09` | dawn | park | Georgy Druzhinin | https://www.pexels.com/photo/11938922/ | Pexels License |
| `park-dawn-10` | dawn | park | Pexels | https://www.pexels.com/photo/3989314/ | Pexels License |
| `park-dawn-11` | dawn | park | Jan Walter Luigi | https://www.pexels.com/photo/16961403/ | Pexels License |
| `park-dawn-12` | dawn | park | Ezgi Kaya | https://www.pexels.com/photo/37426965/ | Pexels License |
| `park-day-01` | day | park | Mateusz D | https://unsplash.com/photos/jT89iHk2hnc | Unsplash License |
| `park-day-02` | day | park | VENUS MAJOR | https://unsplash.com/photos/wxfPSwytxf8 | Unsplash License |
| `park-day-03` | day | park | Richard Burlton | https://unsplash.com/photos/EtJnkKymVP8 | Unsplash License |
| `park-day-04` | day | park | Marcel R | https://unsplash.com/photos/Uhbf6jdnOsA | Unsplash License |
| `park-day-05` | day | park | Philippe Murray-Pietsch | https://unsplash.com/photos/LRs4HiplLYo | Unsplash License |
| `park-day-06` | day | park | Juan Jose Estrada | https://unsplash.com/photos/6O9C9ZFyL_4 | Unsplash License |
| `park-day-07` | day | park | Glennice Burns | https://unsplash.com/photos/E-JJ670KvEU | Unsplash License |
| `park-day-08` | day | park | jack atkinson | https://unsplash.com/photos/CUfDlYxZx8I | Unsplash License |
| `park-day-09` | day | park | Nick Gosset | https://unsplash.com/photos/3DJfakd6VoU | Unsplash License |
| `park-day-10` | day | park | Lysander Yuen | https://unsplash.com/photos/LKaN_tqplEw | Unsplash License |
| `park-day-11` | day | park | Bohdan Hyrovych | https://unsplash.com/photos/wq2qkqvNjjo | Unsplash License |
| `park-day-12` | day | park | Felix yu | https://unsplash.com/photos/9orpQvNujSM | Unsplash License |
| `park-day-13` | day | park | David Kanigan | https://www.pexels.com/photo/39195288/ | Pexels License |
| `park-sunset-01` | sunset | park | Grace Weltch | https://unsplash.com/photos/XR5XUuiK06E | Unsplash License |
| `park-sunset-02` | sunset | park | Akash Randhawa | https://unsplash.com/photos/989-wrY0C1I | Unsplash License |
| `park-sunset-03` | sunset | park | McCarthy Beckan | https://unsplash.com/photos/a6FHROHuQ9o | Unsplash License |
| `park-sunset-04` | sunset | park | Jorge Alberto Vega Barrera | https://unsplash.com/photos/1-nuy7fD3fw | Unsplash License |
| `park-sunset-05` | sunset | park | NHP&Co | https://unsplash.com/photos/UM6oufXjMa8 | Unsplash License |
| `park-sunset-06` | sunset | park | Sebastian Pociecha | https://unsplash.com/photos/hOGpwhlFC5M | Unsplash License |
| `park-sunset-07` | sunset | park | Fien Schelstraete | https://unsplash.com/photos/TQMR6JwOhuk | Unsplash License |
| `park-sunset-08` | sunset | park | Artem Horovenko | https://unsplash.com/photos/axCCLfPJGz4 | Unsplash License |
| `park-sunset-09` | sunset | park | ellen yun | https://unsplash.com/photos/eWjgQVEdLUM | Unsplash License |
| `park-sunset-10` | sunset | park | Pexels | https://www.pexels.com/photo/12267777/ | Pexels License |
| `park-sunset-11` | sunset | park | Michael Pointner | https://www.pexels.com/photo/11920624/ | Pexels License |
| `park-sunset-12` | sunset | park | Pexels | https://www.pexels.com/photo/18715198/ | Pexels License |
| `park-night-01` | night | park | Vlad Ionita | https://unsplash.com/photos/RRz5Or2RzfY | Unsplash License |
| `park-night-02` | night | park | Yanhao Fang | https://unsplash.com/photos/X--fADxhNIs | Unsplash License |
| `park-night-03` | night | park | Zijian Wang | https://unsplash.com/photos/QKcuZ_uAUSA | Unsplash License |
| `park-night-04` | night | park | Christian Lue | https://unsplash.com/photos/iwEw3szy-A0 | Unsplash License |
| `park-night-05` | night | park | Ulf Meyer | https://unsplash.com/photos/cS0W4GvUUDM | Unsplash License |
| `park-night-06` | night | park | Nichika Sakurai | https://unsplash.com/photos/YijoKtr0Xx8 | Unsplash License |
| `park-night-07` | night | park | Kf Zhou | https://www.pexels.com/photo/19146676/ | Pexels License |
| `park-night-08` | night | park | Caique Araujo | https://www.pexels.com/photo/15875672/ | Pexels License |
| `park-night-09` | night | park | Cine Insomnia | https://www.pexels.com/photo/31784001/ | Pexels License |
| `park-night-10` | night | park | Pexels | https://www.pexels.com/photo/15035575/ | Pexels License |
| `park-night-11` | night | park | Pexels | https://www.pexels.com/photo/11748274/ | Pexels License |
| `park-night-12` | night | park | Liathyrax | https://www.pexels.com/photo/35005203/ | Pexels License |
| `city-dawn-01` | dawn | city | Joshua Tsu | https://unsplash.com/photos/k27fjLXCuuo | Unsplash License |
| `city-dawn-02` | dawn | city | Shengpengpeng Cai | https://unsplash.com/photos/cpPteaD54nk | Unsplash License |
| `city-dawn-03` | dawn | city | Candra Winata | https://unsplash.com/photos/CYOFvtpOIpU | Unsplash License |
| `city-dawn-04` | dawn | city | Rob Wilson | https://unsplash.com/photos/1_bK_F0U43o | Unsplash License |
| `city-dawn-05` | dawn | city | Miguel A Amutio | https://unsplash.com/photos/13zjsCSD2fc | Unsplash License |
| `city-dawn-06` | dawn | city | Miguel A Amutio | https://unsplash.com/photos/BKIPY8TuNmI | Unsplash License |
| `city-dawn-07` | dawn | city | MARCOS VERGARA | https://unsplash.com/photos/i8QdlU5E0oM | Unsplash License |
| `city-dawn-08` | dawn | city | First Designs | https://unsplash.com/photos/iq_FLAtcNnc | Unsplash License |
| `city-dawn-09` | dawn | city | Unsplash | https://unsplash.com/photos/fNhGOEIxLPg | Unsplash License |
| `city-dawn-10` | dawn | city | Pexels | https://www.pexels.com/photo/4016898/ | Pexels License |
| `city-dawn-11` | dawn | city | Kevin Christonar | https://www.pexels.com/photo/36717053/ | Pexels License |
| `city-dawn-12` | dawn | city | Pexels | https://www.pexels.com/photo/32139008/ | Pexels License |
| `city-day-01` | day | city | Pierre-Antoine FRANCK | https://unsplash.com/photos/W2pBsQaT6FQ | Unsplash License |
| `city-day-02` | day | city | Zoshua Colah | https://unsplash.com/photos/Ughp996FKQI | Unsplash License |
| `city-day-03` | day | city | Mike Cox | https://unsplash.com/photos/n5MC6lnG5uw | Unsplash License |
| `city-day-04` | day | city | Mathias Reding | https://unsplash.com/photos/MiRyAuFhepg | Unsplash License |
| `city-day-05` | day | city | Pierre-Antoine FRANCK | https://unsplash.com/photos/OpDIYfAb4WQ | Unsplash License |
| `city-day-06` | day | city | charlie dt | https://unsplash.com/photos/e1ATSQThW44 | Unsplash License |
| `city-day-07` | day | city | sporlab | https://unsplash.com/photos/XiZ7pRvCzro | Unsplash License |
| `city-day-08` | day | city | Jakob Owens | https://unsplash.com/photos/A4579vLezz8 | Unsplash License |
| `city-day-09` | day | city | Braden Collum | https://unsplash.com/photos/9HI8UJMSdZA | Unsplash License |
| `city-day-10` | day | city | Austris Augusts | https://unsplash.com/photos/52p1K0d0euM | Unsplash License |
| `city-day-11` | day | city | Tom Morbey | https://unsplash.com/photos/6PujGXV5kyc | Unsplash License |
| `city-day-12` | day | city | Florian Kurrasch | https://unsplash.com/photos/jL4xy2j2p9w | Unsplash License |
| `city-day-13` | day | city | Gabin Vallet | https://unsplash.com/photos/J154nEkpzlQ | Unsplash License |
| `city-sunset-01` | sunset | city | eowynring | https://unsplash.com/photos/nvfh0s5ojjg | Unsplash License |
| `city-sunset-02` | sunset | city | John T | https://unsplash.com/photos/rPKKiHzLFiY | Unsplash License |
| `city-sunset-03` | sunset | city | Arnaud STECKLE | https://unsplash.com/photos/NUkrKjQXRgE | Unsplash License |
| `city-sunset-04` | sunset | city | Steven Lelham | https://unsplash.com/photos/atSaEOeE8Nk | Unsplash License |
| `city-sunset-05` | sunset | city | James Lee | https://unsplash.com/photos/_QvszySFByg | Unsplash License |
| `city-sunset-06` | sunset | city | Felix yu | https://unsplash.com/photos/ZlwCocz11D8 | Unsplash License |
| `city-sunset-07` | sunset | city | Felix yu | https://unsplash.com/photos/xFzxb0sHa3U | Unsplash License |
| `city-sunset-08` | sunset | city | Red Shuheart | https://unsplash.com/photos/8_5yz8f76Hs | Unsplash License |
| `city-sunset-09` | sunset | city | Gilley Aguilar | https://unsplash.com/photos/hbzuvbNv-K0 | Unsplash License |
| `city-sunset-10` | sunset | city | Kyrylo Kholopkin | https://unsplash.com/photos/vcFP4Mkbdz4 | Unsplash License |
| `city-sunset-11` | sunset | city | 6th Era Photography | https://www.pexels.com/photo/9449383/ | Pexels License |
| `city-sunset-12` | sunset | city | Baptiste | https://www.pexels.com/photo/8283485/ | Pexels License |
| `city-night-01` | night | city | Zac Ong | https://unsplash.com/photos/RYvOI54rmPw | Unsplash License |
| `city-night-02` | night | city | Jisu Han | https://unsplash.com/photos/7BlfHlujv2c | Unsplash License |
| `city-night-03` | night | city | Laura Ghise | https://unsplash.com/photos/5DykCHKRm5Q | Unsplash License |
| `city-night-04` | night | city | Jonathan Ikemura | https://unsplash.com/photos/-iyLejolxKg | Unsplash License |
| `city-night-05` | night | city | Fitsum Admasu | https://unsplash.com/photos/oGv9xIl7DkY | Unsplash License |
| `city-night-06` | night | city | Karsten Winegeart | https://unsplash.com/photos/g0-TaMgjzEc | Unsplash License |
| `city-night-07` | night | city | Reza Madani | https://unsplash.com/photos/MvXPoP829x0 | Unsplash License |
| `city-night-08` | night | city | Daniel Olah | https://unsplash.com/photos/2cHW5TKr9Vs | Unsplash License |
| `city-night-09` | night | city | Maddox Fiteny | https://unsplash.com/photos/INE_SCWTUFk | Unsplash License |
| `city-night-10` | night | city | Felix yu | https://unsplash.com/photos/TBaWTWHwpLs | Unsplash License |
| `city-night-11` | night | city | nobleseed nobleseed | https://unsplash.com/photos/oZ2qR5hUGj8 | Unsplash License |
| `city-night-12` | night | city | Vanngo Ng | https://www.pexels.com/photo/38693128/ | Pexels License |
| `city-night-13` | night | city | Limoo | https://www.pexels.com/photo/14532913/ | Pexels License |
| `nature-dawn-01` | dawn | nature | Sage Friedman | https://unsplash.com/photos/TT2J5t1QaMw | Unsplash License |
| `nature-dawn-02` | dawn | nature | Reza Madani | https://unsplash.com/photos/Qi8mZXabCC8 | Unsplash License |
| `nature-dawn-03` | dawn | nature | Isaac Wendland | https://unsplash.com/photos/7DCZgKyp8vw | Unsplash License |
| `nature-dawn-04` | dawn | nature | Venti Views | https://unsplash.com/photos/H9xlJ23Vx8U | Unsplash License |
| `nature-dawn-05` | dawn | nature | Lucas Canino | https://unsplash.com/photos/MFCzJQoFXzc | Unsplash License |
| `nature-dawn-06` | dawn | nature | Tikkho Maciel | https://unsplash.com/photos/2-_WkjmC8x4 | Unsplash License |
| `nature-dawn-07` | dawn | nature | Todd Diemer | https://unsplash.com/photos/ckfkPwCEMNs | Unsplash License |
| `nature-dawn-08` | dawn | nature | Sebastian | https://unsplash.com/photos/yLG33ZcAZ_4 | Unsplash License |
| `nature-dawn-09` | dawn | nature | Deon Collison | https://unsplash.com/photos/Rk62VPlcZqw | Unsplash License |
| `nature-dawn-10` | dawn | nature | Greg Rosenke | https://unsplash.com/photos/LyORqx-3O-c | Unsplash License |
| `nature-dawn-11` | dawn | nature | Unsplash | https://unsplash.com/photos/RVV3BhlwNHY | Unsplash License |
| `nature-dawn-12` | dawn | nature | Nhp Co | https://www.pexels.com/photo/17569863/ | Pexels License |
| `nature-dawn-13` | dawn | nature | Miguel Ramos Oya | https://www.pexels.com/photo/14573489/ | Pexels License |
| `nature-day-01` | day | nature | Ross Sneddon | https://unsplash.com/photos/MypksUaWDTc | Unsplash License |
| `nature-day-02` | day | nature | Vincent Tavernier | https://unsplash.com/photos/jbc3fjn0yWI | Unsplash License |
| `nature-day-03` | day | nature | Jeremy Lapak | https://unsplash.com/photos/CVvFVQ_-oUg | Unsplash License |
| `nature-day-04` | day | nature | Venti Views | https://unsplash.com/photos/-UYedjT31zY | Unsplash License |
| `nature-day-05` | day | nature | Urban Vintage | https://unsplash.com/photos/8TJbrQGKFyU | Unsplash License |
| `nature-day-06` | day | nature | Alessio Soggetti | https://unsplash.com/photos/GYr9A2CPMhY | Unsplash License |
| `nature-day-07` | day | nature | Mario Verduzco | https://unsplash.com/photos/JzU-76CjAaQ | Unsplash License |
| `nature-day-08` | day | nature | Bruno Dias | https://unsplash.com/photos/uv93JzUtbpA | Unsplash License |
| `nature-day-09` | day | nature | Trương Tuyết Ly | https://unsplash.com/photos/YKrel2ShJrg | Unsplash License |
| `nature-day-10` | day | nature | Greg Rosenke | https://unsplash.com/photos/OqP4uMDQ1e0 | Unsplash License |
| `nature-day-11` | day | nature | Deon Collison | https://unsplash.com/photos/2iYi3c180GU | Unsplash License |
| `nature-day-12` | day | nature | Sandra Luimes | https://unsplash.com/photos/CX3LtR-AilA | Unsplash License |
| `nature-day-13` | day | nature | Unsplash | https://unsplash.com/photos/QjfotOvTmfk | Unsplash License |
| `nature-sunset-01` | sunset | nature | Venti Views | https://unsplash.com/photos/I1EWTM5mFEM | Unsplash License |
| `nature-sunset-02` | sunset | nature | Tony Chen | https://unsplash.com/photos/sYEQ88IdTso | Unsplash License |
| `nature-sunset-03` | sunset | nature | Venti Views | https://unsplash.com/photos/hIRzlsl7ERE | Unsplash License |
| `nature-sunset-04` | sunset | nature | Alban ROZES | https://unsplash.com/photos/KTWYIgXmYPg | Unsplash License |
| `nature-sunset-05` | sunset | nature | Vincent Tavernier | https://unsplash.com/photos/coWHN2r_w1M | Unsplash License |
| `nature-sunset-06` | sunset | nature | Winston Tjia | https://unsplash.com/photos/taZonxJEHdI | Unsplash License |
| `nature-sunset-07` | sunset | nature | Akash patil | https://unsplash.com/photos/EE2oJsx8KMU | Unsplash License |
| `nature-sunset-08` | sunset | nature | Cara Denison | https://www.pexels.com/photo/36736878/ | Pexels License |
| `nature-sunset-09` | sunset | nature | Pexels | https://www.pexels.com/photo/20498424/ | Pexels License |
| `nature-sunset-10` | sunset | nature | Ameer Umar | https://www.pexels.com/photo/31407831/ | Pexels License |
| `nature-sunset-11` | sunset | nature | Nhp Co | https://www.pexels.com/photo/16949283/ | Pexels License |
| `nature-sunset-12` | sunset | nature | Pedro Colon | https://www.pexels.com/photo/16527993/ | Pexels License |
| `nature-sunset-13` | sunset | nature | Helder Pereira | https://www.pexels.com/photo/33378438/ | Pexels License |
| `nature-night-01` | night | nature | lucas Favre | https://unsplash.com/photos/JnoNcfFwrNA | Unsplash License |
| `nature-night-02` | night | nature | Mark Stuckey | https://unsplash.com/photos/yiO-Beh1cpk | Unsplash License |
| `nature-night-03` | night | nature | Venti Views | https://unsplash.com/photos/jlphfn0fk4A | Unsplash License |
| `nature-night-04` | night | nature | Pexels | https://www.pexels.com/photo/4330309/ | Pexels License |
| `nature-night-05` | night | nature | Amel Uzunovic | https://www.pexels.com/photo/35924786/ | Pexels License |
| `nature-night-06` | night | nature | Pexels | https://www.pexels.com/photo/4330314/ | Pexels License |
| `nature-night-07` | night | nature | Tomasz Mastalerz | https://www.pexels.com/photo/40098136/ | Pexels License |
| `nature-night-08` | night | nature | Karl Junel Aninon Cagubcob | https://www.pexels.com/photo/15258027/ | Pexels License |
| `nature-night-09` | night | nature | Pexels | https://www.pexels.com/photo/1940040/ | Pexels License |
| `nature-night-10` | night | nature | Nhp Co | https://www.pexels.com/photo/16949285/ | Pexels License |
| `nature-night-11` | night | nature | Arina Dmitrieva | https://www.pexels.com/photo/13894047/ | Pexels License |
| `nature-night-12` | night | nature | Dom Gould | https://www.pexels.com/photo/325790/ | Pexels License |
