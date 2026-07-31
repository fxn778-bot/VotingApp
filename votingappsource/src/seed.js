function member(name, email, eligible, voted) {
  return { name, email, eligible, voted };
}

export const seedCfg = {
  org: "Maple Grove Homeowners Association",
  mtg: "2026 Annual General Meeting",
  quorum: 15,
  items: [
    {
      id: "itm1",
      type: "election",
      title: "Board Director (2 seats)",
      seats: 2,
      thr: "majority",
      abs: false,
      options: ["Amara Chen", "Diego Ruiz", "Priya Nair", "Sam Okafor"],
    },
    {
      id: "itm2",
      type: "motion",
      title: "Approve 2026 Operating Budget",
      seats: 1,
      thr: "majority",
      abs: false,
      options: ["For", "Against", "Abstain"],
    },
  ],
};

export const seedReg = {
  "JQR-482": member("Amara Chen", "amara.chen@example.com", true, true),
  "MXT-719": member("Diego Ruiz", "diego.ruiz@example.com", true, true),
  "PKL-350": member("Priya Nair", "priya.nair@example.com", true, true),
  "WBN-206": member("Sam Okafor", "sam.okafor@example.com", true, false),
  "GFC-931": member("Grace Mutiso", "grace.mutiso@example.com", true, true),
  "TYD-104": member("Peter Otieno", "peter.otieno@example.com", true, true),
  "HNS-573": member("Jane Wanjiru", "", true, true),
  "LZP-826": member("Lucia Fernandez", "lucia.f@example.com", true, true),
  "KVR-458": member("Tom Bakker", "tom.bakker@example.com", true, false),
  "DAM-762": member("Nadia Hassan", "nadia.hassan@example.com", true, true),
  "BQX-315": member("Oliver Bright", "oliver.bright@example.com", true, false),
  "SRT-940": member("Wei Zhang", "wei.zhang@example.com", true, true),
  "FWN-187": member("Fatima Al-Sayed", "fatima.a@example.com", true, true),
  "CUP-624": member("Marcus Webb", "marcus.webb@example.com", true, true),
  "ELV-359": member("Elena Rossi", "elena.rossi@example.com", false, false),
  "HDB-701": member("Hank Dubois", "hank.dubois@example.com", false, false),
  "IKO-543": member("Ines Kova", "ines.kova@example.com", true, false),
  "RVS-268": member("Ravi Shankar", "ravi.shankar@example.com", true, false),
};

export const seedTal = {
  itm1: { "Amara Chen": 7, "Diego Ruiz": 6, "Priya Nair": 5, "Sam Okafor": 3 },
  itm2: { For: 8, Against: 2, Abstain: 1 },
};
