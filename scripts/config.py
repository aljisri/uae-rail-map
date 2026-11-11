"""Hand-curated facts that OpenStreetMap does not hold: line metadata, opening dates,
planned stations, indicative alignments for unbuilt lines, and journey-time calibration.

Every value here was checked against the sources listed on each line (status as of
November 2026). Anything that is an estimate is flagged `approx` (station positions) or
`alignment: "indicative"` (line geometry) so the map can say so.

Coordinates are [lon, lat].
"""

AS_OF = "2026-11-05"

# --------------------------------------------------------------------------------------
# Lines
# --------------------------------------------------------------------------------------
# status: operational | construction | planned
# timeline years: announced -> construction -> opens (the year slider uses these)
# minutes: published end-to-end journey times used to calibrate per-segment times

LINES = [
    {
        "id": "red",
        "name": "Red Line",
        "name_ar": "الخط الأحمر",
        "system": "Dubai Metro",
        "mode": "metro",
        "status": "operational",
        "announced": 2005,
        "construction": 2006,
        "opened": "2009-09-09",
        "length_km": 67.1,
        "stations_total": 35,
        "summary": "The backbone of Dubai: driverless trains along Sheikh Zayed Road from Centrepoint to Life Pharmacy, with the Route 2020 branch to Expo City Dubai.",
        "facts": [
            "First urban metro on the Arabian Peninsula (9 Sept 2009)",
            "Route 2020 branch to Expo City opened in 2021",
            "About 74 minutes from Centrepoint to Expo City Dubai",
        ],
        "sources": [
            "https://en.wikipedia.org/wiki/Red_Line_(Dubai_Metro)",
            "https://www.openstreetmap.org/relation/12820285",
        ],
    },
    {
        "id": "green",
        "name": "Green Line",
        "name_ar": "الخط الأخضر",
        "system": "Dubai Metro",
        "mode": "metro",
        "status": "operational",
        "announced": 2005,
        "construction": 2006,
        "opened": "2011-09-09",
        "length_km": 22.5,
        "stations_total": 20,
        "summary": "Loops through old Dubai under the Creek, from e& in Al Qusais to Creek in Al Jaddaf.",
        "facts": [
            "Al Jadaf and Creek stations added in March 2014",
            "Interchanges with the Red Line at Union and BurJuman",
        ],
        "sources": ["https://en.wikipedia.org/wiki/Green_Line_(Dubai_Metro)"],
    },
    {
        "id": "blue",
        "name": "Blue Line",
        "name_ar": "الخط الأزرق",
        "system": "Dubai Metro",
        "mode": "metro",
        "status": "construction",
        "announced": 2023,
        "construction": 2025,
        "opened": "2029-09-09",
        "length_km": 30,
        "stations_total": 14,
        "summary": "A Y-shaped line linking Creek and Centrepoint to International City, Dubai Silicon Oasis and Academic City, crossing Dubai Creek on a 1.3 km bridge.",
        "facts": [
            "About 25% complete in September 2026; tunnelling began May 2026",
            "15.5 km underground, 14.5 km elevated",
            "Dubai Creek Harbour station designed by SOM, about 74 m tall",
            "AED 20.5 billion contract awarded December 2024",
        ],
        "sources": [
            "https://en.wikipedia.org/wiki/Blue_Line_(Dubai_Metro)",
            "https://www.thenationalnews.com/news/uae/2026/07/09/dubai-metro-blue-line-tunnelling/",
            "https://www.agbi.com/infrastructure/2026/05/tunnelling-work-begins-on-the-dubai-metro-blue-line/",
        ],
    },
    {
        "id": "gold",
        "name": "Gold Line",
        "name_ar": "الخط الذهبي",
        "system": "Dubai Metro",
        "mode": "metro",
        "status": "planned",
        "announced": 2026,
        "construction": None,
        "opened": "2032-09-09",
        "length_km": 42,
        "stations_total": 18,
        "alignment": "indicative",
        "summary": "A fully underground line from Al Ghubaiba to Jumeirah Golf Estates through Al Satwa, City Walk, Business Bay, Meydan and Al Barsha South.",
        "facts": [
            "Approved 22 April 2026, AED 34 billion",
            "18 stations; RTA has not published their locations, so only confirmed interchanges are shown",
            "Projected 465,000 riders a day beyond 2040",
        ],
        "sources": [
            "https://en.wikipedia.org/wiki/Gold_Line_(Dubai_Metro)",
            "https://www.thenationalnews.com/news/uae/2026/04/22/dubai-unveils-9bn-metro-gold-line-linking-city-centre-to-suburbs/",
            "https://www.khaleejtimes.com/uae/dubai-metro-gold-line-route-map-18-stations-new-interchanges-etihad-rail-link",
        ],
    },
    {
        "id": "tram",
        "name": "Dubai Tram",
        "name_ar": "ترام دبي",
        "system": "Dubai Tram",
        "mode": "tram",
        "status": "operational",
        "announced": 2006,
        "construction": 2008,
        "opened": "2014-11-12",
        "length_km": 10.6,
        "stations_total": 11,
        "summary": "Catenary-free tram through Al Sufouh, Dubai Marina and JBR, looping at the Marina end.",
        "facts": [
            "Ground-level power supply, no overhead wires",
            "Interchanges with the Red Line at DMCC and Sobha Realty, and the Palm Monorail at Palm Jumeirah",
        ],
        "sources": ["https://en.wikipedia.org/wiki/Dubai_Tram"],
    },
    {
        "id": "monorail",
        "name": "Palm Monorail",
        "name_ar": "مونوريل النخلة",
        "system": "Palm Monorail",
        "mode": "monorail",
        "status": "operational",
        "announced": 2005,
        "construction": 2006,
        "opened": "2009-04-30",
        "length_km": 5.45,
        "stations_total": 4,
        "summary": "Runs up the trunk of Palm Jumeirah from Palm Gateway to Atlantis Aquaventure.",
        "facts": [
            "The Middle East's first monorail (April 2009)",
            "Suspended December 2025, back in service June 2026",
        ],
        "sources": ["https://en.wikipedia.org/wiki/Palm_Jumeirah_Monorail"],
    },
    {
        "id": "etihad",
        "name": "Etihad Rail passenger",
        "name_ar": "الاتحاد للقطارات",
        "system": "Etihad Rail",
        "mode": "intercity",
        "status": "operational",
        "announced": 2023,
        "construction": None,
        "opened": "2026-06-30",
        "stations_total": 11,
        "summary": "The UAE's first national passenger trains, opening in phases from June 2026 on the Etihad Rail network: Abu Dhabi to Dubai and Fujairah first, then Al Dhafra and Sharjah.",
        "facts": [
            "Abu Dhabi to Dubai in 57 minutes; Abu Dhabi to Fujairah in 1 h 45",
            "Up to 200 km/h; about 400 seats per train",
            "Dubai's Al Yalayis station links to Jumeirah Golf Estates metro by a 400 m footbridge",
        ],
        "sources": [
            "https://en.wikipedia.org/wiki/Etihad_Rail",
            "https://gulfnews.com/uae/transport/etihad-rail-expansion-when-will-the-remaining-passenger-stations-open-1.500619139",
            "https://www.thenationalnews.com/news/uae/2026/01/08/etihad-rail-reveals-more-passenger-stations-ahead-of-service-launch-this-year/",
            "https://www.openstreetmap.org/relation/21261181",
        ],
    },
    {
        "id": "freight",
        "name": "Etihad Rail network",
        "name_ar": "شبكة الاتحاد للقطارات",
        "system": "Etihad Rail",
        "mode": "freight",
        "status": "operational",
        "announced": 2009,
        "construction": None,
        "opened": "2016-01-01",
        "length_km": 900,
        "summary": "The 900 km standard-gauge national network from the Saudi border at Ghuwaifat to Fujairah, with branches to Khalifa Port, Jebel Ali, Ras Al Khaimah and the Shah gas field.",
        "facts": [
            "Stage 1 (Shah, Habshan, Ruwais) carrying sulphur since 2016",
            "Stage 2 completed the national network in February 2023",
            "Planned to join the GCC Railway at Ghuwaifat",
        ],
        "sources": [
            "https://en.wikipedia.org/wiki/Etihad_Rail",
            "https://www.openstreetmap.org/",
        ],
    },
    {
        "id": "hsr",
        "name": "High-speed rail",
        "name_ar": "القطار فائق السرعة",
        "system": "Etihad Rail",
        "mode": "high-speed",
        "status": "planned",
        "announced": 2024,
        "construction": None,
        "opened": "2030",
        "length_km": 150,
        "stations_total": 6,
        "alignment": "indicative",
        "summary": "An electrified 350 km/h line linking Abu Dhabi and Dubai in about 30 minutes, separate from the national network.",
        "facts": [
            "Announced December 2024; expected to be operational by 2030",
            "Stations: Reem Island, Saadiyat Island, Yas Island, Zayed International Airport, Al Maktoum International Airport, Al Jaddaf",
            "RTA plans show it running roughly along Al Khail Road in Dubai",
        ],
        "sources": [
            "https://www.thenationalnews.com/uae/transport/2025/01/24/etihad-rail-map-route-stations-abu-dhabi-dubai/",
            "https://whatson.ae/2026/09/dubai-is-getting-4-etihad-rail-stations-heres-where-theyll-be/",
            "https://en.wikipedia.org/wiki/Etihad_Rail",
        ],
    },
    {
        "id": "hafeet",
        "name": "Hafeet Rail",
        "name_ar": "حفيت للقطارات",
        "system": "Hafeet Rail",
        "mode": "intercity",
        "status": "construction",
        "announced": 2022,
        "construction": 2024,
        "opened": "2027",
        "opened_label": "Trial operations expected late 2027",
        "length_km": 238,
        "stations_total": None,
        "alignment": "partly-indicative",
        "summary": "A UAE-Oman line from the Etihad Rail network near Abu Dhabi through Al Ain to the port of Sohar.",
        "facts": [
            "About 40% complete in April 2026; track laying under way",
            "Abu Dhabi to Sohar in about 100 minutes, Al Ain to Sohar in 47 minutes",
            "Joint venture of Etihad Rail, Oman Rail and Mubadala",
            "UAE section from OpenStreetMap; the Oman section is drawn as an indicative corridor",
        ],
        "sources": [
            "https://www.khaleejtimes.com/uae/hafeet-rail-uae-oman-work-stations-network",
            "https://gulfnews.com/world/gulf/oman/oman-uae-rail-link-to-begin-trial-operations-in-late-2027-1.500676388",
            "https://gulfnews.com/living-in-uae/transport/hafeet-rail-what-to-know-about-the-uae-oman-train-route-1.500222149",
        ],
    },
    {
        "id": "adtram",
        "name": "Abu Dhabi Tram",
        "name_ar": "ترام أبوظبي",
        "system": "Abu Dhabi Tram",
        "mode": "tram",
        "status": "planned",
        "announced": 2025,
        "construction": None,  # expected to start in 2026; no confirmation it has
        "opened": "2030",
        "length_km": 20,
        "stations_total": 23,
        "alignment": "indicative",
        "summary": "Line 4: a light rail line from Yas Island across to Al Raha, Etihad Plaza and Zayed International Airport, with later phases to Khalifa City and a Yas loop.",
        "facts": [
            "Phase 1: about 20 km and 23 stations; 33 km with later phases",
            "Yas Island to Zayed International Airport in about 20 minutes",
            "Only termini and key stops are shown; the full stop list is not public",
        ],
        "sources": [
            "https://en.wikipedia.org/wiki/Abu_Dhabi_Tram",
            "https://gulfnews.com/uae/abu-dhabi-tram-to-link-zayed-airport-with-yas-island-homes-1.500292263",
        ],
    },
]

# --------------------------------------------------------------------------------------
# Station opening dates for OSM-derived lines (keyed by OSM English name)
# --------------------------------------------------------------------------------------
STATION_OPENED = {
    "red": {
        "2009-09-09": ["Centrepoint", "Airport Terminal 3", "Deira City Centre", "Al Rigga", "Union",
                        "BurJuman", "max", "Financial Center", "Mall of the Emirates", "National Paints"],
        "2010-01-04": ["Burj Khalifa / Dubai Mall"],
        "2010-04-30": ["Emirates", "Airport Terminal 1", "ADCB", "Emirates Towers", "Dubai Internet City",
                        "Sobha Realty", "Ibn Battuta"],
        "2010-05-15": ["Al Garhoud", "World Trade Centre", "Garmin"],
        "2010-10-15": ["Business Bay", "Equiti", "InsuranceMarket", "Al Fardan Exchange", "DMCC"],
        "2011-03-11": ["Life Pharmacy"],
        "2012-12-12": ["Danube"],
        "2013-09-30": ["Energy"],
        "2021-01-01": ["The Gardens", "Discovery Gardens", "Al Furjan"],
        "2021-06-01": ["Dubai Investment Park", "Expo City Dubai"],
        "2021-09-01": ["Jumeirah Golf Estates"],
    },
    "green": {
        "2011-09-09": ["e&", "Al Qusais", "Dubai Airport Free Zone", "Al Nahda", "Stadium", "Al Qiyadah",
                        "Abu Hail", "Abu Baker Al Siddique", "Salah Al Din", "Union", "Baniyas Square",
                        "Gold Souq", "Al Ras", "Al Ghubaiba", "Sharaf DG", "BurJuman", "Oud Metha",
                        "Dubai Healthcare City"],
        "2014-03-01": ["Al Jadaf", "Creek"],
    },
    "tram": {"2014-11-12": "*"},
    "monorail": {
        "2009-04-30": ["Palm Gateway", "Atlantis Aquaventure"],
        "2017-07-03": ["Al-Ittihad Park"],
        "2019-11-28": ["Palm Jumeirah Mall"],
    },
}

# Track sections that opened later than the line itself: (line, from station, to station, date)
SEGMENT_OPENED = [
    ("red", "National Paints", "Ibn Battuta", "2010-04-30"),
    ("red", "Ibn Battuta", "Life Pharmacy", "2011-03-11"),
    ("red", "National Paints", "Al Furjan", "2021-01-01"),
    ("red", "Al Furjan", "Expo City Dubai", "2021-06-01"),
    ("green", "Dubai Healthcare City", "Creek", "2014-03-01"),
]
# Route 2020 was built 2016-2020; earlier Red/Green sections were built from 2006.
SEGMENT_CONSTRUCTION = [
    ("red", "National Paints", "Expo City Dubai", 2016),
]

# Display-name fixes for OSM names (keep OSM's spelling otherwise)
NAME_FIXES = {
    "max": "Max",
    "Financial Center": "Financial Centre",
    "InsuranceMarket": "Insurance Market",
    "e&": "e&",
    "Al-Ittihad Park": "Al Ittihad Park",
    "Jumeirah Lakes Towers": "Jumeirah Lakes Towers",
}

# --------------------------------------------------------------------------------------
# Etihad Rail passenger stations
# --------------------------------------------------------------------------------------
# `at` is snapped to the nearest track. `approx` marks stations whose exact site is not in OSM.
ETIHAD_STATIONS = [
    {"id": "er-mbz", "name": "Abu Dhabi (Mohamed bin Zayed City)", "short": "Abu Dhabi", "name_ar": "محطة أبوظبي - مدينة محمد بن زايد",
     "at": [54.52971, 24.33389], "opened": "2026-06-30", "approx": False},
    {"id": "er-faya", "name": "Al Faya", "name_ar": "الفاية", "at": [54.84309, 24.37243], "opened": None, "approx": True,
     "note": "Announced in January 2026; opening date not yet published"},
    {"id": "er-dubai", "name": "Dubai (Al Yalayis)", "short": "Dubai", "name_ar": "محطة دبي - اليلايس",
     "at": [55.16776, 25.01715], "opened": "2026-09-30", "approx": False,
     "note": "At Jumeirah Golf Estates; 400 m footbridge to the Red Line"},
    {"id": "er-shj", "name": "Sharjah (University City)", "short": "Sharjah", "name_ar": "محطة الشارقة - المدينة الجامعية",
     "at": [55.5235, 25.2507], "opened": "2027-03-30", "approx": True},
    {"id": "er-dhaid", "name": "Al Dhaid", "name_ar": "الذيد", "at": [55.85512, 25.31608], "opened": "2026-09-30", "approx": False},
    {"id": "er-fuj", "name": "Fujairah (Al Hilal)", "short": "Fujairah", "name_ar": "محطة الفجيرة - الهلال",
     "at": [56.34564, 25.16832], "opened": "2026-06-30", "approx": False},
    {"id": "er-mirfa", "name": "Al Mirfa", "name_ar": "المرفأ", "at": [53.4871, 24.0962], "opened": "2026-12-30", "approx": True},
    {"id": "er-dhannah", "name": "Al Dhannah", "name_ar": "الظنة", "at": [52.7426, 24.1121], "opened": "2026-12-30", "approx": True,
     "note": "Serves Ruwais"},
    {"id": "er-sila", "name": "Al Sila", "name_ar": "السلع", "at": [51.7520, 24.0965], "opened": "2026-12-30", "approx": True,
     "note": "Westernmost station, near the Saudi border at Ghuwaifat"},
    {"id": "er-mz", "name": "Madinat Zayed", "name_ar": "مدينة زايد", "at": [53.7047, 23.6520], "opened": "2026-11-30", "approx": True},
    {"id": "er-mezairaa", "name": "Mezaira'a (Liwa)", "short": "Liwa", "name_ar": "مزيرعة - ليوا", "at": [53.7829, 23.1270],
     "opened": "2026-11-30", "approx": True},
]

# Passenger service paths, traced along the track between consecutive stations.
# Junction ids are routing-only nodes (not shown as stations).
ETIHAD_JUNCTIONS = {
    "jct-hafeet": [54.8227, 24.2310],   # Hafeet Rail leaves the main line
    "jct-west": [53.8878, 24.0219],     # new Abu Dhabi link meets the Al Dhafra line
    "jct-sharjah": [55.6288, 25.1977],  # Sharjah branch
}
# A leg opens with the earliest-opening station beyond it on any path that uses it.
ETIHAD_PATHS = [
    ["er-mbz", "jct-hafeet", "er-faya", "er-dubai", "jct-sharjah", "er-dhaid", "er-fuj"],
    ["er-dubai", "jct-sharjah", "er-shj"],
    ["er-mbz", "jct-west", "er-mirfa", "er-dhannah", "er-sila"],
    ["er-mbz", "jct-west", "er-mz", "er-mezairaa"],
]
# Published times for calibration: Abu Dhabi-Dubai 57 min, Abu Dhabi-Fujairah 105 min.
ETIHAD_CALIBRATION = [("er-mbz", "er-dubai", 57), ("er-dubai", "er-fuj", 48)]
# Train runs for the animation (the published pattern is still settling; these follow the
# announced station openings).
ETIHAD_SERVICES = [
    ["er-mbz", "jct-hafeet", "er-faya", "er-dubai", "jct-sharjah", "er-dhaid", "er-fuj"],
    ["er-mbz", "jct-west", "er-mirfa", "er-dhannah", "er-sila"],
    ["er-mbz", "jct-west", "er-mz", "er-mezairaa"],
    ["er-mbz", "jct-hafeet", "er-faya", "er-dubai", "jct-sharjah", "er-shj"],
]

# --------------------------------------------------------------------------------------
# Blue Line (alignment from OSM construction ways; most station sites estimated)
# --------------------------------------------------------------------------------------
BLUE_STATIONS = [
    # Creek branch (BG)
    {"id": "bl-creek", "existing": "Creek"},
    {"id": "bl-dfc", "name": "Dubai Festival City", "name_ar": "دبي فستيفال سيتي", "at": [55.3530, 25.2092], "approx": True},
    {"id": "bl-dch", "name": "Dubai Creek Harbour", "name_ar": "مرسى خور دبي", "at": [55.3618, 25.1987], "approx": True,
     "note": "Iconic station by SOM, planned as the world's tallest metro station"},
    {"id": "bl-dsq", "name": "Dubai Square", "name_ar": "دبي سكوير", "at": [55.3593, 25.1914], "approx": True},
    {"id": "bl-rak", "name": "Ras Al Khor Industrial", "name_ar": "رأس الخور الصناعية", "at": [55.3626, 25.1814], "approx": True},
    {"id": "bl-cm", "name": "Car Mart", "name_ar": "سوق السيارات", "at": [55.3745, 25.1748], "approx": True},
    # Trunk (BB)
    {"id": "bl-ic1", "name": "International City 1", "name_ar": "المدينة العالمية 1", "at": [55.3997, 25.1383], "approx": False},
    {"id": "bl-ic2", "name": "International City 2", "name_ar": "المدينة العالمية 2", "at": [55.3884, 25.1206], "approx": False},
    {"id": "bl-dso", "name": "Dubai Silicon Oasis", "name_ar": "واحة دبي للسيليكون", "at": [55.4007, 25.1090], "approx": False},
    {"id": "bl-ac", "name": "Academic City", "name_ar": "المدينة الأكاديمية", "at": [55.4118, 25.0980], "approx": True},
    # Centrepoint branch (BR)
    {"id": "bl-cp", "existing": "Centrepoint"},
    {"id": "bl-mirdif", "name": "City Centre Mirdif", "name_ar": "مردف سيتي سنتر", "at": [55.4098, 25.2136], "approx": False},
    {"id": "bl-warqa", "name": "Al Warqa", "name_ar": "الورقاء", "at": [55.4094, 25.1890], "approx": False},
    {"id": "bl-dragon", "name": "Dragon Mart", "name_ar": "دراغون مارت", "at": [55.4109, 25.1618], "approx": False},
]
BLUE_BRANCHES = [
    ["bl-creek", "bl-dfc", "bl-dch", "bl-dsq", "bl-rak", "bl-cm", "bl-ic1", "bl-ic2", "bl-dso", "bl-ac"],
    ["bl-cp", "bl-mirdif", "bl-warqa", "bl-dragon", "bl-ic1"],
]
# The OSM ways stop short of International City 1 on the Centrepoint branch; bridge the gap.
BLUE_GAP = [[55.4119, 25.1598], [55.4090, 25.1500], [55.4035, 25.1420], [55.3997, 25.1383]]
# Published: Creek to Academic City 25 min; Centrepoint to Academic City 17 min.
BLUE_CALIBRATION = [("bl-creek", "bl-ac", 25), ("bl-cp", "bl-ac", 17)]

# --------------------------------------------------------------------------------------
# Indicative alignments for lines that are not yet mapped
# --------------------------------------------------------------------------------------
GOLD = {
    "waypoints": [
        [55.2889, 25.2650],  # Al Ghubaiba
        [55.2975, 25.2590],
        [55.3040, 25.2544],  # BurJuman
        [55.2900, 25.2400],
        [55.2735, 25.2270],  # Al Satwa
        [55.2630, 25.2075],  # City Walk
        [55.2601, 25.1910],  # Business Bay
        [55.2780, 25.1720],
        [55.2990, 25.1600],  # Meydan
        [55.3030, 25.1440],  # towards Nad Al Sheba / MBR Gardens
        [55.2800, 25.1220],
        [55.2500, 25.1080],  # Dubai Hills
        [55.2300, 25.0870],  # Al Barsha South
        [55.2080, 25.0600],  # Jumeirah Village Circle
        [55.1860, 25.0370],  # Dubai Production City
        [55.1633, 25.0178],  # Jumeirah Golf Estates
    ],
    "stations": [
        {"id": "gl-ghubaiba", "existing": "Al Ghubaiba"},
        {"id": "gl-burjuman", "existing": "BurJuman"},
        {"id": "gl-bb", "existing": "Business Bay"},
        {"id": "gl-meydan", "name": "Meydan", "name_ar": "ميدان", "at": [55.2990, 25.1600], "approx": True,
         "note": "Planned second Etihad Rail integration point"},
        {"id": "gl-jge", "existing": "Jumeirah Golf Estates"},
    ],
    "speed_kmh": 45,
}

HSR = {
    "waypoints": [
        [55.3395, 25.2235],  # Al Jaddaf
        [55.3300, 25.2050],
        [55.3050, 25.1780],
        [55.2650, 25.1500],
        [55.2350, 25.1150],
        [55.2150, 25.0800],
        [55.2000, 25.0400],
        [55.1850, 24.9900],
        [55.1650, 24.9400],
        [55.1500, 24.8900],  # Al Maktoum International Airport
        [55.0500, 24.8000],
        [54.9200, 24.6900],
        [54.7800, 24.5600],
        [54.6900, 24.4800],
        [54.6455, 24.4505],  # Zayed International Airport
        [54.6200, 24.4700],
        [54.6040, 24.4895],  # Yas Island
        [54.5600, 24.5200],
        [54.4900, 24.5400],
        [54.4250, 24.5400],  # Saadiyat Island
        [54.4100, 24.5150],
        [54.4060, 24.4960],  # Reem Island
    ],
    "stations": [
        {"id": "hs-jaddaf", "name": "Al Jaddaf", "name_ar": "الجداف", "at": [55.3395, 25.2235], "approx": True,
         "note": "On the Creek waterfront, near Al Jadaf and Creek metro stations"},
        {"id": "hs-dwc", "name": "Al Maktoum International Airport", "short": "Al Maktoum Airport", "name_ar": "مطار آل مكتوم الدولي",
         "at": [55.1500, 24.8900], "approx": True},
        {"id": "hs-auh", "name": "Zayed International Airport", "short": "Zayed Airport", "name_ar": "مطار زايد الدولي",
         "at": [54.6455, 24.4505], "approx": True},
        {"id": "hs-yas", "name": "Yas Island", "name_ar": "جزيرة ياس", "at": [54.6040, 24.4895], "approx": True},
        {"id": "hs-saadiyat", "name": "Saadiyat Island", "name_ar": "جزيرة السعديات", "at": [54.4250, 24.5400], "approx": True},
        {"id": "hs-reem", "name": "Reem Island", "name_ar": "جزيرة الريم", "at": [54.4060, 24.4960], "approx": True},
    ],
    "minutes": 30,
}

HAFEET = {
    # UAE section comes from OSM (way 1497487228); this continues it through Oman.
    "oman_waypoints": [
        [55.8395, 23.9542],
        [55.9300, 24.0600],
        [56.0200, 24.1700],
        [56.1500, 24.2600],
        [56.3865, 24.2805],  # Wadi Al Jizzi
        [56.5200, 24.3900],
        [56.6142, 24.4908],  # Sohar Port
    ],
    "stations": [
        {"id": "hf-alain", "name": "Al Ain", "name_ar": "العين", "near": [55.7447, 24.2075], "approx": True,
         "note": "Station site not yet published; placed where the line passes closest to Al Ain"},
        {"id": "hf-sohar", "name": "Sohar", "name_ar": "صحار", "at": [56.6142, 24.4908], "approx": True,
         "note": "Line ends at the Port of Sohar, Oman"},
    ],
    # Published: Abu Dhabi to Sohar about 100 min, Al Ain to Sohar 47 min.
    "calibration": [("er-mbz", "hf-alain", 53), ("hf-alain", "hf-sohar", 47)],
}

ADTRAM = {
    "branches": [
        # trunk: Yas Gateway Park -> Zayed International Airport
        [[54.5975, 24.5005], [54.6020, 24.4960], [54.6073, 24.4870], [54.6100, 24.4780], [54.6060, 24.4660],
         [54.6042, 24.4590], [54.6035, 24.4520], [54.6150, 24.4505], [54.6300, 24.4520], [54.6403, 24.4538]],
        # branch: to Etihad Plaza
        [[54.6035, 24.4520], [54.6080, 24.4470], [54.6090, 24.4430]],
        # branch: to Al Raha Mall
        [[54.6035, 24.4520], [54.5900, 24.4475], [54.5741, 24.4390]],
    ],
    "stations": [
        {"id": "at-yasgw", "name": "Yas Gateway Park", "name_ar": "حديقة بوابة ياس", "at": [54.5975, 24.5005], "approx": True},
        {"id": "at-yasmall", "name": "Yas Mall", "name_ar": "ياس مول", "at": [54.6073, 24.4870], "approx": True},
        {"id": "at-yasbay", "name": "Yas Bay", "name_ar": "خليج ياس", "at": [54.6042, 24.4590], "approx": True},
        {"id": "at-raha", "name": "Al Raha", "name_ar": "الراحة", "at": [54.6035, 24.4520], "approx": True},
        {"id": "at-plaza", "name": "Etihad Plaza", "name_ar": "الاتحاد بلازا", "at": [54.6090, 24.4430], "approx": True},
        {"id": "at-rahamall", "name": "Al Raha Mall", "name_ar": "الراحة مول", "at": [54.5741, 24.4390], "approx": True},
        {"id": "at-airport", "name": "Zayed International Airport", "short": "Zayed Airport", "name_ar": "مطار زايد الدولي",
         "at": [54.6403, 24.4538], "approx": True},
    ],
    "paths": [
        ["at-yasgw", "at-yasmall", "at-yasbay", "at-raha", "at-airport"],
        ["at-raha", "at-plaza"],
        ["at-raha", "at-rahamall"],
    ],
    "minutes": [("at-yasgw", "at-airport", 20)],
}

# --------------------------------------------------------------------------------------
# Journey-time model
# --------------------------------------------------------------------------------------
# Average speeds (incl. stops) where no published end-to-end time is used.
SPEED_KMH = {"tram": 20, "monorail": 30}
# Published end-to-end times used to calibrate OSM-derived lines.
CALIBRATION = {
    "red": [("Centrepoint", "Expo City Dubai", 74)],
    "green": [("e&", "Creek", 40)],
}

# Walking links between separate station buildings (minutes, incl. a short wait).
WALK_LINKS = [
    ("er-dubai", "red:Jumeirah Golf Estates", 6),
    ("tram:Jumeirah Lakes Towers", "red:DMCC", 5),
    ("tram:Dubai Marina", "red:Sobha Realty", 5),
    ("tram:Palm Jumeirah", "monorail:Palm Gateway", 6),
    ("hs-jaddaf", "green:Al Jadaf", 7),
    ("hs-jaddaf", "green:Creek", 8),
    ("hs-auh", "at-airport", 5),
    ("hs-yas", "at-yasmall", 5),
]
TRANSFER_MIN = 4  # changing lines inside one station complex

# Etihad Rail network stages (by OSM way name) for the timeline.
# Stage 1: contracts awarded and ground broken October 2011, freight service January 2016.
# Stage 2: track laying under way by January 2021 (start year not confirmed), completed February 2023.
FREIGHT_STAGE1_NAMES = ["Al Gharbia Main Line (GMB)", "Shah Main Line (SHA)", "الخط الرئيسي شاه"]
FREIGHT_STAGES = {
    "stage1": {"opened": "2016-01-01", "construction": 2011},
    "stage2": {"opened": "2023-02-23", "construction": 2021},
    # new Abu Dhabi - Al Dhafra link, mapped as under construction; needed for the
    # Al Dhafra passenger stations scheduled from 30 November 2026
    "link": {"opened": "2026-11-30", "construction": 2023},
}


# --------------------------------------------------------------------------------------
# Station name history (Dubai Metro and Palm Monorail)
# --------------------------------------------------------------------------------------
# Each entry is a name and the date it took effect. `frm` is "YYYY", "YYYY-MM" or
# "YYYY-MM-DD"; None means "from the start" (the station's opening, or earlier).
# Where sources disagree by a day (the two Wikipedia rename tables often do) only the month is
# kept; where only a year is documented, only the year. Entries the sources do not fully settle
# carry a note, which the app shows.
#
# Sources read for this section (November 2026):
#   - Wikipedia: the Red Line and Green Line articles (rename tables) and each station's page
#   - Gulf News guide to Dubai Metro station renames (updated September 2026)
#   - The National, 7 Sept 2026 (Garmin) and 4 Aug 2021 (Centrepoint, Max)
#   - Gulf News / RTA, 14 April 2025 (GGICO to Al Garhoud)
def N(name, frm=None, note=None, pre=False):
    entry = {"n": name, "from": frm}
    if note:
        entry["note"] = note
    if pre:
        entry["pre_opening"] = True
    return entry


_WP = "https://en.wikipedia.org/wiki/"
_RED = _WP + "Red_Line_(Dubai_Metro)"
_GREEN = _WP + "Green_Line_(Dubai_Metro)"
_GN = "https://gulfnews.com/living-in-uae/transport/dubai-metro-stations-renamed-full-list-1.500065961"

NAME_HISTORY = {
    "dm-centrepoint": [N("Rashidiya"), N("Centrepoint", "2021-08")],
    "dm-max": [N("Al Jafiliya"), N("Max", "2021-08")],
    "dm-burjuman": [N("Khalid Bin Al Waleed"),
                    N("BurJuman", "2012", "Sources give 13 November and 12 December 2012.")],
    "dm-adcb": [N("Al Karama"), N("ADCB", "2014-09")],
    "dm-garmin": [
        N("Noor Bank", None, "Wikipedia's rename table also lists “Noor Islamic Bank”, without dates."),
        N("Al Safa", "2020-11"),
        N("Onpassive", "2023-01"),
        N("Garmin", "2026-09", "Announced 7 September 2026 under a 10-year naming-rights deal; signs and apps are being "
                               "updated through November 2026."),
    ],
    "dm-equiti": [N("First Gulf Bank"), N("First Abu Dhabi Bank", "2017-09"), N("Umm Al Sheif", "2020-11"),
                  N("Equiti", "2022-04")],
    "dm-insurance-market": [
        N("Sharaf DG", None, "Opening name inferred: the Sharaf DG (Green Line) page says Mashreq replaced it on "
                             "18 May 2020, while another Wikipedia page lists the two names the other way round."),
        N("Mashreq", "2020-05"),
        N("Insurance Market", "2024-09"),
    ],
    "dm-al-fardan-exchange": [N("Nakheel"), N("Al Khail", "2020-11"), N("Al Fardan Exchange", "2025-03")],
    "dm-sobha-realty": [N("Dubai Marina"), N("DAMAC Properties", "2014-09"), N("Dubai Marina", "2020-11"),
                        N("Sobha Realty", "2021-08")],
    "dm-dmcc": [N("Jumeirah Lakes Towers"), N("DMCC", "2018-08")],
    "dm-national-paints": [N("Nakheel Harbour & Tower"), N("Jebel Ali", "2020-05"), N("National Paints", "2025-06")],
    "dm-life-pharmacy": [N("Jebel Ali"), N("UAE Exchange", "2015-06"), N("Life Pharmacy", "2025-05")],
    "dm-energy": [N("DUBAL"), N("Energy", "2015")],
    "dm-danube": [
        N("Jebel Ali Industrial", None, "Planning and construction name; the station opened as Danube in December 2012.",
          pre=True),
        N("Danube", "2012-11"),
    ],
    "dm-al-garhoud": [
        N("GGICO", None, "Wikipedia also lists “Garhoud” as an earlier name, without dates."),
        N("Al Garhoud", "2025-04-14", "Renamed after its location, effective 14 April 2025."),
    ],
    # id keeps OpenStreetMap's older spelling; the name shown is the current one
    "dm-deira-city-centre": [N("Deira City Centre"), N("City Centre Deira", "2022-06")],
    "dm-expo-city-dubai": [
        N("Expo 2020"),
        N("Expo City Dubai", "2024-03", "Date taken from Wikipedia, which marks it as uncited; no RTA announcement found."),
    ],
    "dm-gold-souq": [N("Palm Deira"), N("Gold Souq", "2020-05")],
    "dm-sharaf-dg": [N("Al Fahidi"), N("Sharaf DG", "2020-11")],
    "dm-e": [N("Etisalat"), N("Etisalat by e&", "2023-02"), N("e&", "2024-09")],
    "pm-palm-jumeirah-mall": [
        N("Nakheel Mall"),
        N("Palm Jumeirah Mall", "2025-09", "The mall was renamed on 3 September 2025 and the station name follows it "
                                          "(shown on Wikipedia; no transit-authority notice found)."),
    ],
}

NAME_SOURCES = {
    "dm-centrepoint": [_WP + "Centrepoint_(Dubai_Metro)", _RED,
                       "https://thenationalnews.com/uae/transport/2021/08/04/dubais-rta-changes-names-of-two-metro-stations"],
    "dm-max": [_WP + "Max_(Dubai_Metro)", _RED,
               "https://thenationalnews.com/uae/transport/2021/08/04/dubais-rta-changes-names-of-two-metro-stations"],
    "dm-burjuman": [_WP + "BurJuman_(Dubai_Metro)", _RED],
    "dm-adcb": [_WP + "ADCB_(Dubai_Metro)", _RED],
    "dm-garmin": [_WP + "Onpassive_(Dubai_Metro)",
                  "https://www.thenationalnews.com/news/uae/2026/09/07/dubais-onpassive-metro-station-renamed-garmin-under-10-year-deal/",
                  _GN],
    "dm-equiti": [_WP + "Equiti_(Dubai_Metro)", _RED, _GN],
    "dm-insurance-market": [_WP + "Insurance_Market_(Dubai_Metro)", _WP + "Sharaf_DG_(Dubai_Metro)", _RED, _GN],
    "dm-al-fardan-exchange": [_WP + "Al_Fardan_Exchange_(Dubai_Metro)", _RED, _GN],
    "dm-sobha-realty": [_WP + "Sobha_Realty_(Dubai_Metro)", _RED],
    "dm-dmcc": [_WP + "DMCC_(Dubai_Metro)", _RED],
    "dm-national-paints": [_WP + "National_Paints_(Dubai_Metro)", _RED, _GN],
    "dm-life-pharmacy": [_WP + "Life_Pharmacy_(Dubai_Metro)", _RED, _GN],
    "dm-energy": [_WP + "Energy_(Dubai_Metro)", _RED],
    "dm-danube": [_WP + "Danube_(Dubai_Metro)", _RED],
    "dm-al-garhoud": [_WP + "GGICO_(Dubai_Metro)", "https://gulfnews.com/uae/dubai-rta-announces-renaming-of-ggico-metro-station-1.500091092"],
    "dm-deira-city-centre": [_WP + "City_Centre_Deira_(Dubai_Metro)", _RED],
    "dm-expo-city-dubai": [_WP + "Expo_2020_(Dubai_Metro)"],
    "dm-gold-souq": [_WP + "Gold_Souq_(Dubai_Metro)", _GN],
    "dm-sharaf-dg": [_WP + "Sharaf_DG_(Dubai_Metro)", _GREEN, _GN],
    "dm-e": [_WP + "E%26_(Dubai_Metro)", _GREEN, _GN],
    "pm-palm-jumeirah-mall": [_WP + "Palm_Jumeirah_Monorail",
                              "https://www.thenationalnews.com/lifestyle/2025/09/03/dubais-nakheel-mall-renamed-palm-jumeirah-mall"],
}
