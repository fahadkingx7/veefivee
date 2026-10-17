/* LeadExtract interactive demo. Synthetic examples are locally generated; no network scraping occurs. */

    // =========================================================================
    // 1. STRICT AGGREGATOR, DIRECTORY & TRAP BLOCKLISTS (PILLAR 1 & 3)
    // =========================================================================
    const DIRECTORY_BLOCKLIST = [
      'yelp.com', 'yellowpages.com', 'angi.com', 'thumbtack.com', 'bbb.org',
      'facebook.com', 'instagram.com', 'linkedin.com', 'tiktok.com', 'nextdoor.com',
      'vagaro.com', 'booksy.com', 'glossgenius.com', 'styleseat.com',
      'mindbodyonline.com', 'zocdoc.com', 'healthgrades.com', 'fresha.com',
      'tripadvisor.com', 'mapquest.com', 'foursquare.com', 'porch.com', 'houzz.com'
    ];

    const TRAP_EMAIL_DOMAINS = [
      'sentry.io', 'sentry-next.wixpress.com', 'wixpress.com', 'squarespace.com',
      'wordpress.org', 'example.com', 'domain.com', 'email.com', 'yoursite.com',
      'company.com', 'schema.org', 'w3.org', 'godaddy.com', 'cloudflare.com'
    ];

    const ASSET_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.css', '.js', '.woff', '.woff2', '.ttf'];

    const TOLL_FREE_PREFIXES = ['800', '888', '877', '866', '855', '844', '833'];

    // =========================================================================
    // 2. REAL ANTI-OBFUSCATION & PARSING ALGORITHMS (PILLAR 2, 3, 4, 5)
    // =========================================================================

    function decodeCfEmail(hexString) {
      if (!hexString || hexString.length < 4) return '';
      try {
        let email = '';
        const key = parseInt(hexString.substr(0, 2), 16);
        for (let i = 2; i < hexString.length; i += 2) {
          const charCode = parseInt(hexString.substr(i, 2), 16) ^ key;
          email += String.fromCharCode(charCode);
        }
        return email.trim().toLowerCase();
      } catch (e) {
        return '';
      }
    }

    function encodeCfEmail(email, key = 0x5a) {
      let hex = key.toString(16).padStart(2, '0');
      for (let i = 0; i < email.length; i++) {
        const encodedByte = (email.charCodeAt(i) ^ key).toString(16).padStart(2, '0');
        hex += encodedByte;
      }
      return hex;
    }

    function deobfuscateTextEmails(rawText) {
      if (!rawText) return '';
      return rawText
        .replace(/&#64;|&#x40;|&commat;|%40/gi, '@')
        .replace(/&#46;|&#x2e;|&period;/gi, '.')
        .replace(/\s*\[\s*at\s*\]\s*|\s*\(\s*at\s*\)\s*|\s+AT\s+/g, '@')
        .replace(/\s*\[\s*dot\s*\]\s*|\s*\(\s*dot\s*\)\s*|\s+DOT\s+/g, '.');
    }

    function validateAndFilterEmail(candidate) {
      if (!candidate) return { valid: false, reason: 'Empty' };
      const clean = candidate.trim().toLowerCase().replace(/^mailto:/i, '').split('?')[0];
      if (!clean.includes('@') || clean.length < 6 || clean.length > 90) {
        return { valid: false, reason: 'Malformed syntax' };
      }
      for (const ext of ASSET_EXTENSIONS) {
        if (clean.endsWith(ext) || clean.includes('@2x') || clean.includes('@3x')) {
          return { valid: false, reason: `Blocked asset/retina trap (${clean})` };
        }
      }
      const [localPart, domainPart] = clean.split('@');
      if (!localPart || !domainPart || !domainPart.includes('.')) {
        return { valid: false, reason: 'Missing domain TLD' };
      }
      for (const trapDomain of TRAP_EMAIL_DOMAINS) {
        if (domainPart === trapDomain || domainPart.endsWith('.' + trapDomain)) {
          return { valid: false, reason: `Blocked platform trap domain (${trapDomain})` };
        }
      }
      if (/^(yourname|name|user|example|test|noreply|no-reply|donotreply|webpack|bundle)$/i.test(localPart)) {
        return { valid: false, reason: `Blocked placeholder/system prefix (${localPart}@)` };
      }
      if (/^[0-9a-f]{16,}$/i.test(localPart)) {
        return { valid: false, reason: `Blocked telemetry hash (${localPart.slice(0, 8)}...@)` };
      }
      return { valid: true, email: clean };
    }

    function classifyEmailTier(email, ownerFirstName, ownerLastName) {
      if (!email) return 'None';
      const local = email.split('@')[0].toLowerCase();
      const genericPrefixes = [
        'info', 'hello', 'contact', 'frontdesk', 'appointments', 'booking', 'bookings',
        'office', 'support', 'inquiries', 'reception', 'care', 'smile', 'salon',
        'studio', 'team', 'service', 'dispatch', 'admin', 'privacy', 'compliance', 'legal'
      ];
      if (ownerFirstName && ownerFirstName.length >= 2) {
        const fn = ownerFirstName.toLowerCase().replace(/[^a-z]/g, '');
        const ln = (ownerLastName || '').toLowerCase().replace(/[^a-z]/g, '');
        if (fn && (local === fn || local.startsWith(fn + '.') || local.startsWith(fn + '_') || local === fn + (ln ? ln[0] : '') || (ln && local === fn[0] + ln))) {
          return 'Direct';
        }
      }
      if (local.startsWith('dr.') || local.startsWith('dr_') || local === 'owner' || local === 'founder') {
        return 'Direct';
      }
      if (genericPrefixes.includes(local)) {
        return 'Generic';
      }
      return ownerFirstName ? 'Direct' : 'Generic';
    }

    function normalizeAndValidatePhone(rawCandidate, contextSnippet = '') {
      if (!rawCandidate) return { valid: false, reason: 'Empty' };
      if (/^\d+px$/i.test(rawCandidate.trim()) || /\d{3,4}x\d{3,4}/i.test(rawCandidate)) {
        return { valid: false, reason: `Blocked CSS dimension (${rawCandidate})` };
      }
      const digits = rawCandidate.replace(/\D/g, '');
      let tenDigits = '';
      if (digits.length === 10) {
        tenDigits = digits;
      } else if (digits.length === 11 && digits.startsWith('1')) {
        tenDigits = digits.slice(1);
      } else {
        return { valid: false, reason: `Invalid digit length (${digits.length} digits in "${rawCandidate}")` };
      }
      const areaCode = tenDigits.slice(0, 3);
      const exchange = tenDigits.slice(3, 6);
      const subscriber = tenDigits.slice(6, 10);

      if (areaCode.startsWith('0') || areaCode.startsWith('1') || areaCode === '555') {
        return { valid: false, reason: `Invalid area code (${areaCode})` };
      }
      if (subscriber === '0000' && exchange === '000') {
        return { valid: false, reason: 'Placeholder zero phone' };
      }
      const e164 = `+1${tenDigits}`;
      const display = `(${areaCode}) ${exchange}-${subscriber}`;
      const isTollFree = TOLL_FREE_PREFIXES.includes(areaCode);
      const lowerCtx = (contextSnippet || '').toLowerCase();
      let lineTier = 'Main / Front Desk Line';
      if (isTollFree) {
        lineTier = 'Toll-Free Line';
      } else if (/(cell|mobile|text|direct|owner|personal)/i.test(lowerCtx)) {
        lineTier = 'Direct / Mobile Line';
      }
      return {
        valid: true,
        e164,
        display,
        areaCode,
        isTollFree,
        lineTier
      };
    }

    function normalizeRootDomain(rawUrl) {
      try {
        const u = new URL(rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl);
        return u.hostname.toLowerCase().replace(/^www\./, '');
      } catch (e) {
        return rawUrl.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
      }
    }

    // =========================================================================
    // 3. GENERATE 150 TO 500+ REALISTIC LOCAL BUSINESS MULTI-PAGE DOM CORPUS
    // =========================================================================
    const MARKET_PRESETS = {
      'hair salons in Austin TX': {
        city: 'Austin', state: 'TX', areaCodes: ['512', '737'],
        tradeLabel: 'Salon & Hair Studio',
        roles: ['Master Stylist & Owner', 'Owner & Artistic Director', 'Founder & Owner', 'Co-Owner', 'Owner'],
        subpages: ['/our-story', '/meet-the-team', '/stylists', '/about-us', '/privacy-policy', '/contact-us'],
        techPool: ['Boulevard', 'Vagaro', 'Square Appointments', 'GlossGenius', 'Acuity Scheduling', 'Phorest', 'Mindbody'],
        prefixes: [
          'Barton Springs', 'South Congress', 'East Austin', 'Zilker', 'Mueller', 'Clarksville', 'Hyde Park', 'Tarrytown',
          'Domain', 'Shoal Creek', 'Travis Heights', 'Bouldin Creek', 'Crestview', 'Allandale', 'Rosedale', 'Holly',
          'Rainey', 'Pease Park', 'Bryker Woods', 'Westlake', 'Bee Cave', 'Lakeway', 'Sunset Valley', 'Oak Hill',
          'North Loop', 'Burnet Road', 'Arboretum', 'Balcones', 'Cat Mountain', 'Barton Creek', 'Lamar', 'Guadalupe',
          'Red River', 'Waller Creek', 'Cesar Chavez', 'Manchaca', 'Oltorf', 'Stassney', 'Brodie', 'Slaughter',
          'Onion Creek', 'Garrison', 'Cherrywood', 'Windsor Park', 'Govalle', 'Montopolis', 'Riverside', 'Pleasant Valley',
          'South First', 'Deep Eddy', 'Mount Bonnell', 'Pennybacker', 'Bull Creek', 'Spicewood', 'Jollyville', 'Anderson Mill',
          'Wells Branch', 'Pflugerville', 'Round Rock', 'Cedar Park', 'Leander', 'Georgetown', 'Buda', 'Kyle',
          'Dripping Springs', 'Wimberley', 'Manor', 'Del Valle', 'Garfield', 'Webberville', 'Hornsby Bend', 'Lost Creek',
          'Rollingwood', 'Rob Roy', 'Davenport', 'Senna Hills', 'Steiner Ranch', 'River Place', 'Courtyard', 'Great Hills',
          'Northwest Hills', 'Highland', 'Wooten', 'Georgian Acres', 'St. Johns', 'Coronado Hills', 'University Hills', 'Pecan Springs',
          'Springdale', 'MLK Studio', 'Rosewood', 'Chestnut', 'Swede Hill', 'Hancock', 'Heritage', 'West Campus',
          'Old Enfield', 'Pemberton', 'Deepwood', 'Barton Hills', 'Dawson', 'Galindo', 'St. Edwards', 'Battle Bend',
          'McKinney Falls', 'Easton Park', 'Southpark', 'Shady Hollow', 'Circle C', 'Meridian', 'Belterra', 'Sweetwater',
          'Rough Hollow', 'Hudson Bend', 'Volente'
        ],
        suffixes: ['Hair Collective', 'Salon & Apothecary', 'Beauty Lounge', 'Hair Studio', 'Curl & Color Bar', 'Atelier Salon', 'Botanical Hair Co.', 'Parlor & Spa', 'Cuts & Color', 'Hair Sanctuary']
      },
      'dental practices in Denver CO': {
        city: 'Denver', state: 'CO', areaCodes: ['303', '720'],
        tradeLabel: 'Dental & Orthodontics',
        roles: ['Lead DDS & Owner', 'Practice Owner', 'Founder & Lead DDS', 'Managing Partner', 'Principal'],
        subpages: ['/doctors', '/meet-the-team', '/about-us', '/providers', '/privacy-policy', '/contact-us'],
        techPool: ['NexHealth', 'OpenDental', 'JaneApp', 'Calendly', 'Acuity Scheduling', 'Square Appointments'],
        prefixes: [
          'LoDo', 'RiNo', 'Cherry Creek', 'Wash Park', 'Highlands', 'Sloan Lake', 'Capitol Hill', 'Cheesman Park',
          'Congress Park', 'City Park', 'Park Hill', 'Stapleton', 'Central Park', 'Lowry', 'Hilltop', 'Montclair',
          'Hale', 'Mayfair', 'Cory-Merrill', 'Bonnie Brae', 'Belcaro', 'University Park', 'Platt Park', 'Speer',
          'Baker', 'Golden Triangle', 'Five Points', 'Whittier', 'Cole', 'Clayton', 'Skyland', 'City Park West',
          'Uptown', 'North Capitol', 'Berkeley', 'Tennyson', 'Sunnyside', 'Chaffee Park', 'Regis', 'West Highland',
          'Jefferson Park', 'Villa Park', 'Barnum', 'Valverde', 'Athmar Park', 'Ruby Hill', 'Mar Lee', 'Harvey Park',
          'Bear Valley', 'Fort Logan', 'Overland', 'Rosedale', 'Virginia Village', 'Indian Creek', 'Goldsmith', 'Hampden',
          'Southmoor', 'University Hills', 'Wellshire', 'Greenwood Village', 'Littleton', 'Englewood', 'Arvada', 'Wheat Ridge',
          'Lakewood', 'Golden', 'Morrison', 'Evergreen', 'Westminster', 'Broomfield', 'Thornton', 'Northglenn',
          'Commerce City', 'Aurora', 'Centennial', 'Highlands Ranch', 'Lone Tree', 'Parker', 'Castle Rock', 'Ken Caryl',
          'Columbine', 'Bow Mar', 'Sheridan', 'Edgewater', 'Mountain View', 'Lakeside', 'Applewood', 'Genesee',
          'Kittredge', 'Idledale', 'Conifer', 'Bailey', 'Roxborough', 'Chatfield', 'Louviers', 'Sedalia',
          'Franktown', 'Elizabeth', 'Kiowa', 'Bennett', 'Strasburg', 'Brighton', 'Erie', 'Superior',
          'Louisville', 'Lafayette', 'Boulder Creek', 'Flatirons', 'Gunbarrel', 'Niwot', 'Longmont', 'Loveland',
          'Front Range', 'Mile High', 'Red Rocks'
        ],
        suffixes: ['Family Dentistry', 'Dental Studio', 'Smile Collective', 'Cosmetic & Implant Dental', 'Modern Dentistry', 'Dental Wellness', 'Orthodontics & Dental', 'Dental Arts', 'Gentle Dental Care', 'Premier Dentistry']
      },
      'med spas in Miami FL': {
        city: 'Miami', state: 'FL', areaCodes: ['305', '786'],
        tradeLabel: 'Med Spa & Aesthetics',
        roles: ['Lead MD & Medical Director', 'Founder & CEO', 'Practice Owner', 'Co-Founder & Owner', 'Managing Partner'],
        subpages: ['/providers', '/our-team', '/founders', '/about-us', '/privacy-policy', '/book'],
        techPool: ['Boulevard', 'Zenoti', 'Mindbody', 'JaneApp', 'Vagaro', 'Acuity Scheduling'],
        prefixes: [
          'Brickell', 'Wynwood', 'Coconut Grove', 'Coral Gables', 'Design District', 'South Beach', 'Midtown Miami', 'Edgewater',
          'Key Biscayne', 'Sunny Isles', 'Aventura', 'Bal Harbour', 'Surfside', 'Miami Shores', 'Biscayne', 'Morningside',
          'Belle Meade', 'Upper East Side', 'Little Havana', 'Shenandoah', 'Silver Bluff', 'The Roads', 'Pinecrest', 'Palmetto Bay',
          'Cutler Bay', 'Kendall', 'Doral', 'Sweetwater', 'Westchester', 'South Miami', 'Highland Lakes', 'Golden Beach',
          'North Miami', 'Bay Harbor', 'Indian Creek', 'Fisher Island', 'Star Island', 'Venetian', 'Sunset Harbour', 'Flamingo Park',
          'Collins Park', 'North Beach', 'Normandy Isles', 'Mid-Beach', 'Faena District', 'Overtown', 'Allapattah', 'Grapeland',
          'Flagami', 'Fontainebleau', 'Tamiami', 'Kendale Lakes', 'The Crossings', 'The Hammocks', 'Country Walk', 'Three Lakes',
          'Richmond Heights', 'Perrine', 'Goulds', 'Princeton', 'Naranja', 'Homestead', 'Florida City', 'Redland',
          'Miami Lakes', 'Hialeah', 'Miami Springs', 'Virginia Gardens', 'Medley', 'Opa-locka', 'Miami Gardens', 'Miramar',
          'Pembroke Pines', 'Hollywood Beach', 'Hallandale', 'Dania Beach', 'Fort Lauderdale', 'Las Olas', 'Victoria Park', 'Rio Vista',
          'Harbor Beach', 'Coral Ridge', 'Imperial Point', 'Lauderdale-by-the-Sea', 'Pompano', 'Lighthouse Point', 'Deerfield', 'Boca Raton',
          'Mizner Park', 'Delray Beach', 'Atlantic Ave', 'Highland Beach', 'Ocean Ridge', 'Manalapan', 'Palm Beach', 'Worth Ave',
          'West Palm', 'Wellington', 'Jupiter', 'Tequesta', 'Biscayne Bay', 'Matheson', 'Snapper Creek', 'Cocoplum',
          'Gables Estates', 'Tahiti Beach', 'Old Cutler', 'Deering', 'Vizcaya', 'Venetia', 'Omni', 'Bayside',
          'PortMiami', 'Brickell Key', 'Atlantis'
        ],
        suffixes: ['Aesthetics & MedSpa', 'Longevity & Laser Clinic', 'Skin & Wellness Studio', 'Medical Aesthetics', 'Rejuvenation Lounge', 'Injectables & Laser Bar', 'Dermal Institute', 'Vitality MedSpa', 'Boutique Aesthetics', 'Glow Medical Spa']
      },
      'HVAC & plumbing in Phoenix AZ': {
        city: 'Phoenix', state: 'AZ', areaCodes: ['602', '480', '623'],
        tradeLabel: 'HVAC & Plumbing',
        roles: ['Owner', 'Founder & CEO', 'President', 'Co-Owner', 'Managing Partner'],
        subpages: ['/about-us', '/our-story', '/leadership', '/contact-us', '/privacy-policy', '/locations'],
        techPool: ['ServiceTitan', 'Housecall Pro', 'Jobber', 'Calendly', 'Square Appointments'],
        prefixes: [
          'Camelback', 'Arcadia', 'Biltmore', 'Scottsdale', 'Tempe', 'Chandler', 'Gilbert', 'Mesa',
          'Glendale', 'Peoria', 'Surprise', 'Avondale', 'Goodyear', 'Buckeye', 'Cave Creek', 'Carefree',
          'Paradise Valley', 'Fountain Hills', 'Ahwatukee', 'Desert Ridge', 'Norterra', 'Deer Valley', 'Moon Valley', 'Sunnyslope',
          'North Mountain', 'Encanto', 'Willo Historic', 'Roosevelt Row', 'Coronado', 'Garfield', 'Arcadia Lite', 'Papago',
          'South Mountain', 'Laveen', 'Estrella', 'Maryvale', 'Alhambra', 'Midtown Phoenix', 'Uptown Phoenix', 'Bethany Home',
          'Orangewood', 'Royal Palm', 'Willo', 'Fairview', 'Cheery Lynn', 'Windsor Square', 'Pierson Place', 'Medlock',
          'Squaw Peak', 'Dreamy Draw', 'Shadow Mountain', 'Lookout Mountain', 'Thunderbird', 'Arrowhead', 'Westgate', 'Verrado',
          'Palm Valley', 'Litchfield Park', 'Tolleson', 'El Mirage', 'Youngtown', 'Sun City', 'Anthem', 'New River',
          'Rio Verde', 'McCormick Ranch', 'Gainey Ranch', 'Kierland', 'Grayhawk', 'DC Ranch', 'Silverleaf', 'Troon',
          'Pinnacle Peak', 'Terravita', 'Boulders', 'Old Town', 'South Scottsdale', 'McDowell', 'Salt River', 'Mill Ave',
          'Kyrene', 'Warner', 'Ray Road', 'Ocotillo', 'Fulton Ranch', 'Seville', 'Agritopia', 'Val Vista',
          'Power Ranch', 'Morrison Ranch', 'Highland', 'Superstition', 'Red Mountain', 'Las Sendas', 'Lehi', 'Dobson Ranch',
          'Guadalupe', 'Queen Creek', 'San Tan', 'Maricopa', 'Casa Grande', 'Florence', 'Coolidge', 'Apache Junction',
          'Gold Canyon', 'Wickenburg', 'Tonopah', 'Wittmann', 'Waddell', 'Citrus Park', 'Desert Hills', 'Tramonto',
          'Sonoran', 'Valley Sun', 'Copper State'
        ],
        suffixes: ['Cooling & Plumbing', 'HVAC & Mechanical', 'Air Conditioning & Drain', 'Comfort Systems', 'Home Services', 'Heating, Cooling & Plumbing', 'Climate Control Pros', 'Plumbing & Air Co.', 'Mechanical Services', 'Thermal & Pipe Works']
      },
      'boutique fitness in Seattle WA': {
        city: 'Seattle', state: 'WA', areaCodes: ['206', '425'],
        tradeLabel: 'Boutique Fitness & Pilates',
        roles: ['Founder & Owner', 'Owner', 'Co-Founder', 'Master Instructor & Owner', 'CEO'],
        subpages: ['/our-team', '/founders', '/our-story', '/about-us', '/privacy-policy', '/book'],
        techPool: ['Mindbody', 'Mariana Tek', 'Glofox', 'Vagaro', 'Acuity Scheduling', 'Square Appointments'],
        prefixes: [
          'Capitol Hill', 'Ballard', 'Fremont', 'Queen Anne', 'Belltown', 'South Lake Union', 'Green Lake', 'Wallingford',
          'University District', 'Ravenna', 'Wedgewood', 'Laurelhurst', 'Madison Park', 'Madrona', 'Leschi', 'Mount Baker',
          'Columbia City', 'Beacon Hill', 'Georgetown', 'West Seattle', 'Alki Beach', 'Admiral', 'Fauntleroy', 'Magnolia',
          'Interbay', 'Phinney Ridge', 'Greenwood', 'Crown Hill', 'Loyal Heights', 'Sunset Hill', 'Northgate', 'Maple Leaf',
          'Roosevelt', 'Bryant', 'View Ridge', 'Sand Point', 'Windermere', 'Hawthorne Hills', 'Montlake', 'Eastlake',
          'Westlake', 'Pioneer Square', 'International District', 'First Hill', 'Central District', 'Judkins Park', 'Seward Park', 'Rainier Beach',
          'Othello', 'Brighton', 'Dunlap', 'South Park', 'White Center', 'Burien', 'Normandy Park', 'Des Moines',
          'Tukwila', 'Renton', 'Newcastle', 'Mercer Island', 'Bellevue', 'Clyde Hill', 'Medina', 'Hunts Point',
          'Yarrow Point', 'Kirkland', 'Juanita', 'Totem Lake', 'Redmond', 'Sammamish', 'Issaquah', 'Snoqualmie',
          'North Bend', 'Fall City', 'Woodinville', 'Bothell', 'Kenmore', 'Lake Forest Park', 'Shoreline', 'Richmond Beach',
          'Edmonds', 'Lynnwood', 'Mountlake Terrace', 'Brier', 'Mill Creek', 'Mukilteo', 'Everett', 'Snohomish',
          'Bainbridge', 'Vashon', 'Bremerton', 'Poulsbo', 'Gig Harbor', 'Tacoma', 'Proctor', 'Ruston Way',
          'Puyallup', 'Sumner', 'Auburn', 'Kent', 'Covington', 'Maple Valley', 'Black Diamond', 'Enumclaw',
          'Puget Sound', 'Emerald City', 'Elliott Bay', 'Lake Washington', 'Cascade', 'Olympic View', 'Rainier', 'Discovery'
        ],
        suffixes: ['Pilates & Movement', 'Reformer Studio', 'Strength & Cycle', 'Barre & Yoga Collective', 'Athletic Club', 'Fitness Loft', 'Core & Conditioning', 'Sculpt Studio', 'Row & Ride Lab', 'Mindful Movement Co.']
      }
    };

    const OWNER_FIRST_NAMES = [
      'Shawna', 'Elena', 'Marcus', 'Devon', 'Camila', 'Julian', 'Tessa', 'Nadia', 'Gavin', 'Kendra',
      'Mateo', 'Brielle', 'Soren', 'Valerie', 'Darius', 'Hannah', 'Liam', 'Claire', 'Rafael', 'Monica',
      'Zoe', 'Trevor', 'Amina', 'Garrett', 'Sienna', 'Victor', 'Mallory', 'Cedric', 'Paige', 'Aiden',
      'Lydia', 'Preston', 'Noelle', 'Desmond', 'Celeste', 'Keegan', 'Sabrina', 'Wesley', 'Fiona', 'Arthur',
      'Bianca', 'Collin', 'Maya', 'Reid', 'Naomi', 'Spence', 'Giselle', 'Miles', 'Audrey', 'Logan',
      'Vera', 'Holden', 'Talia', 'Graham', 'Elise', 'Caleb', 'Miriam', 'Jude', 'Serena', 'Duncan',
      'Chloe', 'Roman', 'Astrid', 'Kieran', 'Eva', 'Malcolm', 'Carmen', 'Rhys', 'Helena', 'Samson',
      'Nina', 'Bram', 'Simone', 'Declan', 'Iris', 'Quentin', 'Corinne', 'Jonah', 'Rosalie', 'Leland',
      'Ariana', 'Sterling', 'Clara', 'Vaughn', 'Phoebe', 'Harlan', 'Esme', 'Conrad', 'Daphne', 'Leif',
      'Colette', 'Warren', 'Maren', 'Ellis', 'Sloane', 'Porter', 'Juliet', 'Trent', 'Maeve', 'Cormac',
      'Linnea', 'Alden', 'Blythe', 'Tristan', 'Sylvia', 'Brooks', 'Greta', 'Emmett', 'Freya', 'Clint',
      'Annalise', 'Vince', 'Margot', 'Davis', 'Paloma'
    ];

    const OWNER_LAST_NAMES = [
      'Vance', 'Reyes', 'Lindqvist', 'Callahan', 'Moreno', 'Whitaker', 'Okafor', 'Bouchard', 'Kowalski', 'Harrington',
      'Delgado', 'Sorensen', 'Alvarez', 'Mercer', 'Chen', 'Strickland', 'Patel', 'Gallagher', 'Nakamura', 'Sinclair',
      'Montoya', 'Ashford', 'Haddad', 'McAllister', 'Rousseau', 'Ellison', 'Castillo', 'Kessler', 'Bergstrom', 'Carmichael',
      'Peralta', 'Thatcher', 'Mendoza', 'Langley', 'Vanderbilt', 'Navarro', 'Holbrook', 'Salazar', 'Waverly', 'Kavanagh',
      'Trevino', 'Bellingham', 'Duarte', 'Pembroke', 'Solis', 'Radcliffe', 'Espinoza', 'Kingsley', 'Padilla', 'Winthrop',
      'Dominguez', 'Sterling', 'Cabrera', 'Fairchild', 'Rosales', 'Prescott', 'Acosta', 'Lockwood', 'Figueroa', 'Caldwell',
      'Cervantes', 'Blackwood', 'Molina', 'Crawford', 'Fuentes', 'Lancaster', 'Ochoa', 'Thornton', 'Miranda', 'Beaumont',
      'Rivas', 'Aldridge', 'Valdez', 'Stafford', 'Zuniga', 'Winslow', 'Gallegos', 'Chantry', 'Cordova', 'Redmond',
      'Bautista', 'Kenilworth', 'Villarreal', 'Hastings', 'Cisneros', 'Montague', 'Benitez', 'Somerset', 'Arellano', 'Windsor',
      'Huerta', 'Kensington', 'Tapia', 'Carrington', 'Alvarado', 'Arundel', 'Beltran', 'Stanhope', 'Orozco', 'Pennington',
      'Pineda', 'Grosvenor', 'Villa', 'Berkley', 'Escobar', 'Middleton', 'Cuevas', 'Danvers', 'Deleon', 'Chatsworth',
      'Rangel', 'Halifax', 'Lucero', 'Claremont', 'Marquez'
    ];

    const DISTRICT_MODIFIERS = ['', 'North ', 'South ', 'East ', 'West ', 'Uptown ', 'Downtown ', 'Midtown ', 'Old Town ', 'Heights '];

    function buildCorpusForQuery(rawQuery, desiredTarget = 150) {
      const presetKey = Object.keys(MARKET_PRESETS).find(k => k.toLowerCase() === rawQuery.trim().toLowerCase());
      let config;
      if (rawQuery === 'all-trades-mega' || rawQuery.includes('All Trades') || rawQuery.includes('All Local Trades')) {
        config = MARKET_PRESETS['hair salons in Austin TX'];
      } else if (presetKey) {
        config = MARKET_PRESETS[presetKey];
      } else {
        const parts = rawQuery.split(/\s+in\s+/i);
        const customTrade = (parts[0] || 'Local Business').trim().replace(/[<>\"'&]/g, '');
        const customLoc = (parts[1] || 'Austin TX').trim().replace(/[<>\"'&]/g, '');
        const cityMatch = customLoc.split(/[\s,]+/);
        const city = cityMatch[0] || 'Austin';
        const state = (cityMatch[1] && cityMatch[1].length === 2 ? cityMatch[1].toUpperCase() : 'TX');
        config = {
          city,
          state,
          areaCodes: ['512', '303', '404'],
          tradeLabel: customTrade.charAt(0).toUpperCase() + customTrade.slice(1),
          roles: ['Owner', 'Founder & CEO', 'Co-Owner', 'Managing Partner', 'Principal'],
          subpages: ['/about-us', '/our-team', '/our-story', '/privacy-policy', '/contact-us', '/leadership'],
          techPool: ['Square Appointments', 'Calendly', 'Acuity Scheduling', 'Vagaro', 'Boulevard', 'Toast', 'ServiceTitan'],
          prefixes: MARKET_PRESETS['hair salons in Austin TX'].prefixes,
          suffixes: [
            customTrade.replace(/s$/i, '') + ' Co.',
            customTrade.replace(/s$/i, '') + ' Studio',
            customTrade.replace(/s$/i, '') + ' Collective',
            customTrade.replace(/s$/i, '') + ' Group',
            customTrade.replace(/s$/i, '') + ' Partners',
            customTrade.replace(/s$/i, '') + ' Works'
          ]
        };
      }

      const validLeads = [];
      const serpQueueLog = [];
      let serpRank = 1;

      const totalValidToBuild = Math.max(165, desiredTarget + 25);
      const tradeKeys = Object.keys(MARKET_PRESETS);

      for (let i = 0; i < totalValidToBuild; i++) {
        const activeConfig = (rawQuery === 'all-trades-mega' || rawQuery.includes('All Trades') || rawQuery.includes('All Local Trades'))
          ? MARKET_PRESETS[tradeKeys[i % tradeKeys.length]]
          : config;

        if (i % 5 === 0) {
          const dirDomain = DIRECTORY_BLOCKLIST[(i / 5) % DIRECTORY_BLOCKLIST.length];
          const slug = activeConfig.city.toLowerCase() + '-' + activeConfig.tradeLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          serpQueueLog.push({
            rank: serpRank++,
            rawUrl: `https://www.${dirDomain}/search/${slug}-top-10-${i + 1}`,
            rootDomain: dirDomain,
            status: 'BLOCKED_DIRECTORY',
            reason: `Aggregator/Directory blocklist match (${dirDomain}) — Slot auto-replenished`
          });
        }
        if (i % 10 === 2 && validLeads.length > 0) {
          const prevLead = validLeads[validLeads.length - 1];
          serpQueueLog.push({
            rank: serpRank++,
            rawUrl: `https://www.${prevLead.rootDomain}/services-pricing?loc=${activeConfig.city.toLowerCase()}`,
            rootDomain: prevLead.rootDomain,
            status: 'DUPLICATE_ROOT',
            reason: `Root-domain deduplication (${prevLead.rootDomain} already queued) — Slot auto-replenished`
          });
        }
        if (i % 9 === 4) {
          const deadDomain = `${activeConfig.prefixes[i % activeConfig.prefixes.length].toLowerCase().replace(/[^a-z]/g, '')}oldsite${i}.com`;
          const failTypes = [
            'HTTP 404 Not Found — Dead site skipped & replenished',
            'HTTP 502 Bad Gateway — Origin timeout (>3500ms) skipped & replenished',
            'Parked Domain Detected (GoDaddy CashParking signature) — Skipped & replenished'
          ];
          serpQueueLog.push({
            rank: serpRank++,
            rawUrl: `https://${deadDomain}/`,
            rootDomain: deadDomain,
            status: 'HTTP_ERROR_OR_PARKED',
            reason: failTypes[i % failTypes.length]
          });
        }

        const basePrefix = activeConfig.prefixes[i % activeConfig.prefixes.length];
        const modifier = i >= activeConfig.prefixes.length ? DISTRICT_MODIFIERS[Math.floor(i / activeConfig.prefixes.length) % DISTRICT_MODIFIERS.length] : '';
        const prefix = `${modifier}${basePrefix}`.trim();
        const suffix = activeConfig.suffixes[(i + Math.floor(i / activeConfig.prefixes.length)) % activeConfig.suffixes.length];
        const bizName = `${prefix} ${suffix}`;
        const cleanSlug = (prefix + suffix.split(' ')[0] + (i >= activeConfig.prefixes.length ? String(i + 1) : '')).toLowerCase().replace(/[^a-z0-9]/g, '');
        const rootDomain = `${cleanSlug}${activeConfig.city.toLowerCase().slice(0, 3)}.com`;
        const websiteUrl = `https://${rootDomain}`;

        const fn = OWNER_FIRST_NAMES[(i * 2 + Math.floor(i / 50)) % OWNER_FIRST_NAMES.length];
        const ln = OWNER_LAST_NAMES[(i * 3 + 7) % OWNER_LAST_NAMES.length];
        const role = activeConfig.roles[i % activeConfig.roles.length];

        const isOwnerExplicitlyNamed = (i % 7 !== 6);
        const ownerFullName = isOwnerExplicitlyNamed ? `${fn} ${ln}` : 'Not explicitly named on site';
        const ownerFirstName = isOwnerExplicitlyNamed ? fn : '';
        const ownerLastName = isOwnerExplicitlyNamed ? ln : '';
        const verifiedRole = isOwnerExplicitlyNamed ? role : 'Unverified (Staff-Only / No Principal Title)';

        const subpageChoice = activeConfig.subpages[i % activeConfig.subpages.length];
        const sourcePageUrl = `${websiteUrl}${subpageChoice}`;
        const crawledSubpages = [
          '/',
          subpageChoice,
          activeConfig.subpages[(i + 1) % activeConfig.subpages.length],
          '/contact-us',
          '/privacy-policy'
        ].filter((v, idx, a) => a.indexOf(v) === idx).slice(0, 4);

        const isDirectEmail = isOwnerExplicitlyNamed && (i % 3 !== 2);
        const primaryEmailRaw = isDirectEmail
          ? `${fn.toLowerCase()}@${rootDomain}`
          : `${['hello', 'info', 'frontdesk', 'appointments', 'office'][i % 5]}@${rootDomain}`;
        const secondaryEmail = isDirectEmail
          ? `appointments@${rootDomain}`
          : (i % 2 === 0 ? `billing@${rootDomain}` : `connect@${rootDomain}`);

        const deobfuscationModes = [
          'Cloudflare data-cfemail XOR Hex',
          'JSON-LD schema.org/LocalBusiness',
          'Wix Warmup / Next.js Hydration JSON',
          'HTML Character Entities (&#64; / &#46;)',
          'DOM mailto: Anchor (Footer/Menu)',
          'Human Obfuscation ([at] / [dot])'
        ];
        const extractionMethod = deobfuscationModes[i % deobfuscationModes.length];

        const isTollFree = (i % 14 === 13);
        const areaCode = isTollFree
          ? TOLL_FREE_PREFIXES[i % TOLL_FREE_PREFIXES.length]
          : activeConfig.areaCodes[i % activeConfig.areaCodes.length];
        const exch = String(210 + ((i * 7) % 680)).padStart(3, '0');
        const sub = String(1100 + ((i * 53) % 8800)).padStart(4, '0');
        const rawPhoneStr = `(${areaCode}) ${exch}-${sub}`;
        const phoneContext = (i % 4 === 0 && !isTollFree) ? 'Direct Owner Cell / Text Line' : 'Main Front Desk';
        const phoneValidation = normalizeAndValidatePhone(rawPhoneStr, phoneContext);

        let evidenceSnippet = '';
        if (!isOwnerExplicitlyNamed) {
          evidenceSnippet = `Meet our talented team members Jenna, Carlos, and Priya at ${bizName} in ${activeConfig.city} (no owner title stated).`;
        } else if (subpageChoice === '/privacy-policy') {
          evidenceSnippet = `This Privacy Policy governs ${bizName} LLC, owned and operated by ${fn} ${ln}, ${role}, reachable at ${primaryEmailRaw}.`;
        } else {
          evidenceSnippet = `Founded in ${2014 + (i % 10)} by ${fn} ${ln}, ${role} at ${bizName}, dedicated to serving ${activeConfig.city} clients.`;
        }

        const blockedTraps = [
          `hero-banner@2x.png`,
          `a8f93c11d4@sentry.io`,
          ...(i % 2 === 0 ? [`template@wixpress.com`] : [`icon-logo.svg`, `1920x1080`])
        ];

        const bookingTool = activeConfig.techPool[i % activeConfig.techPool.length];
        const igHandle = `https://instagram.com/${cleanSlug}_${activeConfig.city.toLowerCase()}`;
        const fbPage = `https://facebook.com/${cleanSlug}${activeConfig.state.toLowerCase()}`;

        const cfHex = encodeCfEmail(primaryEmailRaw, 0x42 + (i % 20));
        const rawHtmlSnippet = `<!-- Crawled from ${sourcePageUrl} (HTTP 200 OK) -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "${bizName}",
  "url": "${websiteUrl}",
  "telephone": "${phoneValidation.display}",
  "email": "${secondaryEmail}"${isOwnerExplicitlyNamed ? `,\n  "founder": { "@type": "Person", "name": "${fn} ${ln}", "jobTitle": "${role}" }` : ''}
}
<\/script>
<section class="about-bio-block">
  <h2>${isOwnerExplicitlyNamed ? `${fn} ${ln} — ${role}` : `Our ${activeConfig.city} Team`}</h2>
  <p>${evidenceSnippet}</p>
  <a href="/cdn-cgi/l/email-protection" class="__cf_email__" data-cfemail="${cfHex}">[email&#160;protected]</a>
  <a href="tel:${phoneValidation.e164}" class="phone-link">${phoneContext}: ${phoneValidation.display}</a>
</section>
<!-- Ignored False-Positive Traps in DOM -->
<img src="/assets/hero-banner@2x.png" width="1920" height="1080" />
<script>window.__SENTRY_DSN__ = "https://a8f93c11d4@sentry.io/4501";<\/script>
<!-- Booking Widget & Supplementary Socials -->
<a href="https://book.${bookingTool.toLowerCase().replace(/\s+/g, '')}.com/${cleanSlug}">Book via ${bookingTool}</a>
<a href="${igHandle}">Instagram</a> | <a href="${fbPage}">Facebook</a>`;

        const emailTier = classifyEmailTier(primaryEmailRaw, ownerFirstName, ownerLastName);

        const leadObj = {
          id: `lead-${i + 1}`,
          index: i + 1,
          bizName,
          rootDomain,
          websiteUrl,
          sourcePageUrl,
          subpagePath: subpageChoice,
          crawledSubpages,
          isOwnerExplicitlyNamed,
          ownerFullName,
          ownerFirstName,
          ownerLastName,
          verifiedRole,
          primaryEmail: primaryEmailRaw,
          emailTier,
          secondaryEmails: [secondaryEmail],
          extractionMethod,
          phoneDisplay: phoneValidation.display,
          phoneE164: phoneValidation.e164,
          phoneLineTier: phoneValidation.lineTier,
          isTollFree: phoneValidation.isTollFree,
          evidenceSnippet,
          blockedTraps,
          bookingTool,
          igHandle,
          fbPage,
          searchQueryUsed: (rawQuery === 'all-trades-mega' || rawQuery.includes('All Trades') || rawQuery.includes('All Local Trades')) ? `${activeConfig.tradeLabel} in ${activeConfig.city} ${activeConfig.state}` : rawQuery,
          rawHtmlSnippet,
          latencyMs: 180 + ((i * 29) % 340)
        };

        validLeads.push(leadObj);
        serpQueueLog.push({
          rank: serpRank++,
          rawUrl: `${websiteUrl}/`,
          rootDomain,
          status: 'ACCEPTED',
          reason: `Valid reachable local business (HTTP 200 · ${crawledSubpages.length} subpages crawled)`
        });
      }

      return { validLeads, serpQueueLog };
    }

    // =========================================================================
    // 4. APPLICATION STATE & LOCALSTORAGE VAULT (DEFAULT 150 + CUSTOM INPUT)
    // =========================================================================
    let appState = {
      activeTab: 'leadEngine',
      viewMode: 'cards',
      currentQuery: 'hair salons in Austin TX',
      batchTarget: 150,
      streamSpeed: 'turbo',
      skipSavedDomains: true,
      savedVaultDomains: {},
      customBlockedDomains: [],
      allValidLeads: [],
      streamedLeads: [],
      serpQueueLog: [],
      isStreaming: false,
      streamTimer: null
    };

    function getRequestedBatchTarget() {
      const customInp = document.getElementById('customBatchInput');
      let val = customInp ? parseInt(customInp.value, 10) : 150;
      if (isNaN(val) || val < 1) val = 150;
      if (val > 500) val = 500;
      return val;
    }

    function loadSavedVault() {
      try {
        const raw = localStorage.getItem('proprietor_v2_saved_vault');
        if (raw) {
          appState.savedVaultDomains = JSON.parse(raw) || {};
        }
      } catch (e) {
        appState.savedVaultDomains = {};
      }
      updateSavedVaultBadges();
    }

    function persistSavedVault() {
      try {
        localStorage.setItem('proprietor_v2_saved_vault', JSON.stringify(appState.savedVaultDomains));
      } catch (e) {}
      updateSavedVaultBadges();
    }

    function updateSavedVaultBadges() {
      const count = Object.keys(appState.savedVaultDomains).length;
      const badge = document.getElementById('savedVaultCountBadge');
      const subtext = document.getElementById('skipSavedSubtext');
      if (badge) badge.textContent = String(count);
      if (subtext) subtext.textContent = `(${count} domain${count === 1 ? '' : 's'} in browser storage)`;
    }

    function showToast(message, tone = 'emerald') {
      const container = document.getElementById('toastContainer');
      if (!container) return;
      const toast = document.createElement('div');
      const dotCol = tone === 'emerald' ? 'bg-[#258b7c]' : 'bg-[#c78c55]';
      toast.className = `px-4 py-3 rounded-xl bg-white border border-[#e4e0ee] shadow-xl text-xs font-semibold text-[#282440] flex items-center gap-2.5 card-enter`;
      toast.innerHTML = `<span class="w-2.5 h-2.5 rounded-full ${dotCol} shrink-0"></span><span></span>`;
      toast.lastElementChild.textContent = message;
      container.appendChild(toast);
      setTimeout(() => {
        toast.remove();
      }, 3200);
    }

    // =========================================================================
    // 5. STREAMING ENGINE & QUEUE REPLENISHMENT EXECUTION (PILLAR 1 & 5)
    // =========================================================================
    function executeLeadBatch(instant = false) {
      if (appState.streamTimer) {
        clearInterval(appState.streamTimer);
        appState.streamTimer = null;
      }

      const queryInput = document.getElementById('searchQueryInput');
      const query = (queryInput && queryInput.value.trim()) ? queryInput.value.trim() : 'hair salons in Austin TX';
      appState.currentQuery = query;

      const requestedTarget = getRequestedBatchTarget();
      appState.batchTarget = requestedTarget;

      const speedSelect = document.getElementById('streamSpeedSelect');
      appState.streamSpeed = speedSelect ? speedSelect.value : 'turbo';

      const skipToggle = document.getElementById('skipSavedToggle');
      appState.skipSavedDomains = skipToggle ? skipToggle.checked : true;

      const { validLeads, serpQueueLog } = buildCorpusForQuery(query, requestedTarget);
      const filteredLeads = [];
      const finalSerpLog = [];

      for (const logItem of serpQueueLog) {
        if (logItem.status !== 'ACCEPTED') {
          if (filteredLeads.length < requestedTarget) {
            finalSerpLog.push(logItem);
          }
          continue;
        }
        if (appState.skipSavedDomains && appState.savedVaultDomains[logItem.rootDomain]) {
          finalSerpLog.push({
            ...logItem,
            status: 'SKIPPED_SAVED',
            reason: `Cross-session deduplication: ${logItem.rootDomain} already in Saved Vault — Auto-replenished next organic domain`
          });
          continue;
        }
        if (appState.customBlockedDomains.includes(logItem.rootDomain)) {
          finalSerpLog.push({
            ...logItem,
            status: 'BLOCKED_DIRECTORY',
            reason: `Custom user blocklist match (${logItem.rootDomain}) — Auto-replenished`
          });
          continue;
        }
        if (filteredLeads.length < requestedTarget) {
          const matchingLead = validLeads.find(l => l.rootDomain === logItem.rootDomain);
          if (matchingLead) {
            filteredLeads.push({
              ...matchingLead,
              index: filteredLeads.length + 1
            });
            finalSerpLog.push(logItem);
          }
        }
      }

      appState.allValidLeads = filteredLeads;
      appState.serpQueueLog = finalSerpLog;

      if (instant || appState.streamSpeed === 'instant') {
        appState.streamedLeads = [...filteredLeads];
        appState.isStreaming = false;
        updateTelemetryAndRender();
        renderSerpQueueLog();
        return;
      }

      appState.streamedLeads = [];
      appState.isStreaming = true;
      const chunkSize = appState.streamSpeed === 'turbo' ? Math.max(6, Math.ceil(filteredLeads.length / 16)) : 1;
      const intervalMs = appState.streamSpeed === 'turbo' ? 55 : 160;

      updateTelemetryAndRender();

      appState.streamTimer = setInterval(() => {
        const nextSlice = filteredLeads.slice(appState.streamedLeads.length, appState.streamedLeads.length + chunkSize);
        if (nextSlice.length === 0) {
          clearInterval(appState.streamTimer);
          appState.streamTimer = null;
          appState.isStreaming = false;
          updateTelemetryAndRender();
          renderSerpQueueLog();
          showToast(`Search complete: ${appState.streamedLeads.length} verified business leads ready.`);
          return;
        }
        appState.streamedLeads.push(...nextSlice);
        updateTelemetryAndRender();
      }, intervalMs);
    }

    // =========================================================================
    // 6. TELEMETRY SCORECARDS, CARD STREAMING & CRM TABLE RENDERING
    // =========================================================================
    function getFilteredStreamedLeads() {
      const searchVal = (document.getElementById('leadFilterInput')?.value || '').trim().toLowerCase();
      const ownerFilter = document.getElementById('ownerFilterSelect')?.value || 'all';
      const emailTierFilter = document.getElementById('emailTierFilterSelect')?.value || 'all';
      const techFilter = document.getElementById('techFilterSelect')?.value || 'all';

      return appState.streamedLeads.filter(lead => {
        if (searchVal) {
          const hay = `${lead.bizName} ${lead.rootDomain} ${lead.ownerFullName} ${lead.verifiedRole} ${lead.primaryEmail} ${lead.phoneDisplay} ${lead.bookingTool} ${lead.subpagePath}`.toLowerCase();
          if (!hay.includes(searchVal)) return false;
        }
        if (ownerFilter === 'verified' && !lead.isOwnerExplicitlyNamed) return false;
        if (ownerFilter === 'unstated' && lead.isOwnerExplicitlyNamed) return false;
        if (ownerFilter === 'privacy' && lead.subpagePath !== '/privacy-policy') return false;

        if (emailTierFilter === 'Direct' && lead.emailTier !== 'Direct') return false;
        if (emailTierFilter === 'Generic' && lead.emailTier !== 'Generic') return false;
        if (emailTierFilter === 'deobfuscated' && !/(cfemail|Entities|Obfuscation)/i.test(lead.extractionMethod)) return false;

        if (techFilter !== 'all' && lead.bookingTool !== techFilter) return false;
        return true;
      });
    }

    function updateTelemetryAndRender() {
      const leads = appState.streamedLeads;
      const totalTarget = appState.allValidLeads.length || appState.batchTarget;

      const dot = document.getElementById('streamStatusDot');
      const statusText = document.getElementById('streamStatusText');
      const progressBar = document.getElementById('streamProgressBar');
      const skippedItems = appState.serpQueueLog.filter(x => x.status !== 'ACCEPTED');

      if (appState.isStreaming && leads.length < totalTarget) {
        const currentLead = appState.allValidLeads[leads.length] || leads[leads.length - 1];
        if (dot) dot.className = 'w-2 h-2 rounded-full bg-[#c78c55] animate-ping shrink-0';
        if (statusText && currentLead) {
          statusText.textContent = `Crawling ${currentLead.subpagePath} on ${currentLead.rootDomain} (${leads.length + 1} of ${totalTarget})...`;
        }
        const pct = Math.min(100, Math.round((leads.length / Math.max(1, totalTarget)) * 100));
        if (progressBar) progressBar.style.width = `${pct}%`;
      } else {
        if (dot) dot.className = 'w-2 h-2 rounded-full bg-[#258b7c] shrink-0';
        if (statusText) {
          statusText.textContent = `${leads.length} / ${totalTarget} verified local businesses ready · ${skippedItems.length} directory/dead links auto-refilled`;
        }
        if (progressBar) progressBar.style.width = '100%';
      }

      const dirCount = appState.serpQueueLog.filter(x => x.status === 'BLOCKED_DIRECTORY').length;
      const dupCount = appState.serpQueueLog.filter(x => x.status === 'DUPLICATE_ROOT' || x.status === 'SKIPPED_SAVED').length;
      const errCount = appState.serpQueueLog.filter(x => x.status === 'HTTP_ERROR_OR_PARKED').length;
      const totalScanned = leads.length + dirCount + dupCount + errCount;

      const verifiedOwners = leads.filter(l => l.isOwnerExplicitlyNamed).length;
      const unstatedOwners = leads.length - verifiedOwners;
      const directEmails = leads.filter(l => l.emailTier === 'Direct').length;
      const genericEmails = leads.filter(l => l.emailTier === 'Generic').length;
      const deobCount = leads.filter(l => /(cfemail|Entities|Obfuscation)/i.test(l.extractionMethod)).length;
      const subpagesCount = leads.reduce((acc, l) => acc + l.crawledSubpages.length, 0);
      const jsonldCount = leads.filter(l => l.extractionMethod.includes('JSON-LD')).length;
      const hydrationCount = leads.filter(l => l.extractionMethod.includes('Hydration')).length;
      const trapsBlocked = leads.reduce((acc, l) => acc + l.blockedTraps.length, 0);

      document.getElementById('navCountBadge').textContent = String(leads.length);
      document.getElementById('navSkippedBadge').textContent = `${skippedItems.length} skipped`;
      document.getElementById('statValidDomains').textContent = String(leads.length);
      document.getElementById('statTargetGoal').textContent = `/ ${totalTarget} target`;
      document.getElementById('statSerpScanned').textContent = `Scanned ${totalScanned} SERP URLs`;

      document.getElementById('statReplenishedCount').textContent = String(skippedItems.length);
      document.getElementById('statReplenishedBreakdown').textContent = `${dirCount} dir · ${dupCount} dup · ${errCount} dead`;

      document.getElementById('statVerifiedOwners').textContent = String(verifiedOwners);
      document.getElementById('statUnstatedOwners').textContent = `(${unstatedOwners} unstated)`;

      document.getElementById('statDirectEmails').textContent = String(directEmails);
      document.getElementById('statGenericEmails').textContent = `direct · ${genericEmails} role`;
      document.getElementById('statDeobfuscatedCount').textContent = `${deobCount} cfemail/entity decoded`;

      document.getElementById('statSubpagesCrawled').textContent = String(subpagesCount);
      document.getElementById('statHydrationParsed').textContent = `${jsonldCount} JSON-LD · ${hydrationCount} Hydration`;

      document.getElementById('statTrapsBlocked').textContent = String(trapsBlocked);
      document.getElementById('statBookingSignals').textContent = `${leads.length} booking tools tagged`;

      renderFilteredLeadsView();
    }

    function renderFilteredLeadsView() {
      const filtered = getFilteredStreamedLeads();
      const countLabel = document.getElementById('visibleLeadsCountLabel');
      if (countLabel) {
        countLabel.textContent = `Showing ${filtered.length} of ${appState.streamedLeads.length} leads`;
      }

      const cardGrid = document.getElementById('leadsCardGrid');
      const tableContainer = document.getElementById('leadsTableContainer');
      const tableBody = document.getElementById('leadsTableBody');

      if (appState.viewMode === 'cards') {
        cardGrid.classList.remove('hidden');
        tableContainer.classList.add('hidden');
        cardGrid.innerHTML = filtered.map(lead => renderLeadCardHtml(lead)).join('');
      } else {
        cardGrid.classList.add('hidden');
        tableContainer.classList.remove('hidden');
        tableBody.innerHTML = filtered.map(lead => renderLeadTableRowHtml(lead)).join('');
      }
    }

    function renderLeadCardHtml(lead) {
      const isSaved = Boolean(appState.savedVaultDomains[lead.rootDomain]);
      const ownerBadgeClass = lead.isOwnerExplicitlyNamed
        ? 'bg-[#ddf3ed] text-[#245d56] border-[#bde1d6]'
        : 'bg-[#fff1d8] text-[#736139] border-[#ffdfb3]';

      const emailBadgeClass = lead.emailTier === 'Direct'
        ? 'bg-[#ddf3ed] text-[#245d56] border border-[#bde1d6]'
        : 'bg-[#e7e2ff] text-[#51449d] border border-[#dcd6fa]';

      const phoneBadgeClass = lead.phoneLineTier.includes('Direct')
        ? 'bg-[#ddf3ed] text-[#245d56]'
        : (lead.isTollFree ? 'bg-[#fff1d8] text-[#736139]' : 'bg-[#f0edfa] text-[#595574]');

      const subpagesPills = lead.crawledSubpages.map(sp => {
        const isHit = sp === lead.subpagePath;
        return `<span class="px-2 py-0.5 rounded-md font-mono text-[10px] ${isHit ? 'bg-[#edeaff] text-[#6457e9] border border-[#dcd6fa] font-bold' : 'bg-[#faf9ff] text-[#77718f] border border-[#f0edfa]'}">${sp}</span>`;
      }).join('');

      return `
      <article class="card-enter hybrid-card hybrid-card-hover overflow-hidden flex flex-col justify-between">
        <!-- Bootstrap-Style Card Header -->
        <div class="bg-[#faf9ff] border-b border-[#e4e0ee] px-4 py-3 flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-md bg-[#f0edfa] text-[#595574] font-mono text-[10px] font-bold">#${lead.index}</span>
              <h3 class="font-bold text-[15px] text-[#282440] truncate" title="${lead.bizName}">${lead.bizName}</h3>
            </div>
            <div class="flex items-center gap-2 mt-0.5">
              <a href="${lead.websiteUrl}" target="_blank" rel="noopener noreferrer" class="text-xs font-semibold text-[#6457e9] hover:underline truncate">${lead.rootDomain}</a>
              <span class="text-[10px] text-[#77718f] font-mono">· 200 OK (${lead.latencyMs}ms)</span>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <button type="button" data-action="save-lead" data-domain="${lead.rootDomain}" class="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${isSaved ? 'bg-[#ddf3ed] text-[#245d56] border-[#bde1d6]' : 'bg-white hover:bg-[#f0edfa] text-[#595574] border-[#d6d0e7]'}">
              ${isSaved ? 'Saved ✓' : 'Save'}
            </button>
            <button type="button" data-action="inspect-provenance" data-id="${lead.id}" class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#edeaff] hover:bg-[#e7e2ff] text-[#6457e9] border border-[#dcd6fa] transition" title="Inspect Verbatim Provenance & DOM">
              DOM Proof
            </button>
          </div>
        </div>

        <!-- Card Body -->
        <div class="p-4 space-y-3 flex-1">
          <!-- Owner Resolution Box -->
          <div class="p-3 rounded-xl bg-[#faf9ff] border border-[#f0edfa] space-y-1.5">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <span class="text-[10px] uppercase tracking-wider font-bold text-[#77718f]">Owner / Decision-Maker</span>
              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold border ${ownerBadgeClass}">
                ${lead.verifiedRole}
              </span>
            </div>
            <div class="text-[15px] font-extrabold ${lead.isOwnerExplicitlyNamed ? 'text-[#282440]' : 'text-[#736139] italic'}">
              ${lead.ownerFullName}
            </div>
            <div class="pt-1.5 border-t border-[#e4e0ee] text-[11px] text-[#595574] leading-relaxed">
              <span class="font-mono text-[10px] font-bold text-[#6457e9]">[${lead.subpagePath}]</span>
              <span class="italic"> "${lead.evidenceSnippet}"</span>
            </div>
          </div>

          <!-- Contact Rows -->
          <div class="space-y-2 text-xs">
            <div class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-[#e4e0ee]">
              <div class="min-w-0">
                <div class="font-mono text-xs font-bold text-[#282440] truncate">${lead.primaryEmail}</div>
                <div class="text-[10px] text-[#77718f] truncate">${lead.extractionMethod}</div>
              </div>
              <span class="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold ${emailBadgeClass}">
                ${lead.emailTier}
              </span>
            </div>

            <div class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-[#e4e0ee]">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-mono text-xs font-bold text-[#282440]">${lead.phoneDisplay}</span>
                <span class="font-mono text-[10px] font-semibold text-[#245d56] bg-[#ddf3ed] px-2 py-0.5 rounded-md">${lead.phoneE164}</span>
              </div>
              <span class="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold ${phoneBadgeClass}">
                ${lead.phoneLineTier.replace(' Line', '')}
              </span>
            </div>
          </div>
        </div>

        <!-- Bootstrap-Style Card Footer -->
        <div class="bg-[#faf9ff] border-t border-[#e4e0ee] px-4 py-2.5 space-y-2">
          <div class="flex flex-wrap items-center gap-1">
            ${subpagesPills}
          </div>
          <div class="flex items-center justify-between gap-2 text-[11px]">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="px-2 py-0.5 rounded-md bg-[#eee6ff] text-[#65439c] font-bold text-[10px]">
                ${lead.bookingTool}
              </span>
              <span class="px-2 py-0.5 rounded-md bg-[#fbe6ee] text-[#9b4d6b] text-[10px] font-semibold" title="Blocked traps: ${lead.blockedTraps.join(', ')}">
                ${lead.blockedTraps.length} traps stripped
              </span>
            </div>
            <div class="flex items-center gap-2 font-bold text-[11px] text-[#77718f]">
              <a href="${lead.igHandle}" target="_blank" rel="noopener noreferrer" class="hover:text-[#6457e9] transition">IG ↗</a>
              <span>·</span>
              <a href="${lead.fbPage}" target="_blank" rel="noopener noreferrer" class="hover:text-[#6457e9] transition">FB ↗</a>
            </div>
          </div>
        </div>
      </article>`;
    }

    function renderLeadTableRowHtml(lead) {
      return `
      <tr class="hover:bg-[#faf9ff] transition">
        <td class="py-3 px-4 font-mono text-[#77718f] font-bold">#${lead.index}</td>
        <td class="py-3 px-4">
          <div class="font-bold text-[#282440]">${lead.bizName}</div>
          <div class="font-mono text-[11px] text-[#6457e9]">${lead.rootDomain}</div>
        </td>
        <td class="py-3 px-4 font-bold ${lead.isOwnerExplicitlyNamed ? 'text-[#282440]' : 'text-[#736139] italic'}">${lead.ownerFullName}</td>
        <td class="py-3 px-4 font-mono text-[11px] text-[#595574]">${lead.ownerFirstName || '—'} / ${lead.ownerLastName || '—'}</td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${lead.isOwnerExplicitlyNamed ? 'bg-[#ddf3ed] text-[#245d56]' : 'bg-[#fff1d8] text-[#736139]'}">${lead.verifiedRole}</span>
        </td>
        <td class="py-3 px-4">
          <div class="font-mono text-[11px] font-bold text-[#282440]">${lead.primaryEmail}</div>
          <div class="text-[10px] text-[#77718f]">${lead.emailTier} · ${lead.extractionMethod}</div>
        </td>
        <td class="py-3 px-4">
          <div class="font-mono text-[11px] font-bold text-[#245d56]">${lead.phoneE164}</div>
          <div class="text-[10px] text-[#77718f]">${lead.phoneDisplay}</div>
        </td>
        <td class="py-3 px-4 max-w-xs">
          <div class="font-mono text-[10px] text-[#6457e9]">${lead.sourcePageUrl}</div>
          <div class="text-[11px] text-[#595574] italic line-clamp-2">"${lead.evidenceSnippet}"</div>
        </td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded-md bg-[#eee6ff] text-[#65439c] text-[10px] font-bold">${lead.bookingTool}</span>
          <button type="button" data-action="inspect-provenance" data-id="${lead.id}" class="ml-1.5 text-[#6457e9] font-bold hover:underline text-[11px]">Inspect</button>
        </td>
      </tr>`;
    }

    // =========================================================================
    // 7. SERP QUEUE REPLENISHMENT LOG & BLOCKLIST MANAGER (PILLAR 1)
    // =========================================================================
    function renderSerpQueueLog() {
      const filterVal = document.getElementById('serpLogFilterSelect')?.value || 'all';
      const tbody = document.getElementById('serpQueueTableBody');
      if (!tbody) return;

      const rows = appState.serpQueueLog.filter(item => filterVal === 'all' || item.status === filterVal);
      tbody.innerHTML = rows.map(item => {
        let badge = '';
        if (item.status === 'ACCEPTED') {
          badge = `<span class="px-2 py-0.5 rounded-md bg-[#ddf3ed] text-[#245d56] font-sans font-bold text-[10px]">ACCEPTED</span>`;
        } else if (item.status === 'BLOCKED_DIRECTORY') {
          badge = `<span class="px-2 py-0.5 rounded-md bg-[#fbe6ee] text-[#9b4d6b] font-sans font-bold text-[10px]">DIRECTORY BLOCKED</span>`;
        } else if (item.status === 'DUPLICATE_ROOT') {
          badge = `<span class="px-2 py-0.5 rounded-md bg-[#fff1d8] text-[#736139] font-sans font-bold text-[10px]">DEDUPLICATED</span>`;
        } else if (item.status === 'SKIPPED_SAVED') {
          badge = `<span class="px-2 py-0.5 rounded-md bg-[#eee6ff] text-[#65439c] font-sans font-bold text-[10px]">SAVED VAULT SKIP</span>`;
        } else {
          badge = `<span class="px-2 py-0.5 rounded-md bg-[#fff1d8] text-[#736139] font-sans font-bold text-[10px]">404/PARKED REFILLED</span>`;
        }
        return `
        <tr class="hover:bg-[#faf9ff]">
          <td class="py-2.5 px-4 text-[#77718f]">#${item.rank}</td>
          <td class="py-2.5 px-4 text-[#282440] truncate max-w-xs">${item.rawUrl}</td>
          <td class="py-2.5 px-4 text-[#6457e9] font-bold">${item.rootDomain}</td>
          <td class="py-2.5 px-4">${badge}</td>
          <td class="py-2.5 px-4 font-sans text-[#595574]">${item.reason}</td>
        </tr>`;
      }).join('');
    }

    function renderBlocklistPills() {
      const container = document.getElementById('blocklistPillsContainer');
      if (!container) return;
      const combined = [...DIRECTORY_BLOCKLIST, ...appState.customBlockedDomains];
      container.innerHTML = combined.map(dom => `
        <span class="px-3 py-1 rounded-lg bg-[#faf9ff] border border-[#e4e0ee] text-xs font-mono text-[#9b4d6b] font-semibold flex items-center gap-1.5">
          <span>${dom}</span>
        </span>
      `).join('');
    }

    // =========================================================================
    // 8. LIVE HTML DE-OBFUSCATOR & ZERO-GUESSING PARSER LAB (PILLAR 2, 3, 4, 5)
    // =========================================================================
    const SAMPLE_HTML_PAYLOADS = {
      cfemail_wix: {
        url: 'https://bartonbelledesign.com/our-story',
        html: `<!-- Sample 1: Cloudflare data-cfemail Hex + Wix Warmup Hydration State -->
<header>
  <a href="/cdn-cgi/l/email-protection" class="__cf_email__" data-cfemail="${encodeCfEmail('shawna@bartonbelledesign.com', 0x5a)}">[email&#160;protected]</a>
  <a href="tel:512-482-9910">Direct Cell: (512) 482-9910</a>
</header>
<section class="founder-card">
  <h2>Shawna Vance — Master Stylist &amp; Owner</h2>
  <p>Founded in 2018 by Shawna Vance, Master Stylist &amp; Owner at Barton Belle Design, serving Austin clients with organic color.</p>
</section>
<script id="wix-warmup-data" type="application/json">
  {"business":{"email":"appointments@bartonbelledesign.com","booking":"https://vagaro.com/bartonbelledesign","instagram":"https://instagram.com/bartonbelleatx"}}
<\/script>
<!-- False-Positive Traps that LeadExtract Me Pro Must Strip -->
<img src="/static/stylist-portrait@2x.png" width="1920" height="1080" />
<script>const dsn = "https://998123ab@sentry.io/1293"; const tpl = "user@wixpress.com";<\/script>`
      },
      privacy_llc: {
        url: 'https://lodosmilecollective.com/privacy-policy',
        html: `<!-- Sample 2: Registered LLC & Owner Disclosed Inside /privacy-policy + HTML Entities -->
<main class="legal-document">
  <h1>Privacy Policy &amp; HIPAA Notice</h1>
  <p>This website is operated by LoDo Smile Collective LLC, led by Marcus Lindqvist, Lead DDS &amp; Owner in Denver, Colorado.</p>
  <p>For compliance or direct owner inquiries, contact Dr. Lindqvist at: marcus&#64;lodosmilecollective&#46;com or frontdesk [at] lodosmilecollective [dot] com.</p>
  <p>Main Clinic Line: <a href="tel:+13038194420">(303) 819-4420</a> | Toll-Free Patient Line: (888) 412-9090</p>
  <a href="https://nexhealth.com/book/lodosmile">Schedule via NexHealth</a>
</main>`
      },
      staff_only: {
        url: 'https://eastsidecurlbar.com/stylists',
        html: `<!-- Sample 3: Multiple Staff Listed WITHOUT Ownership Titles (Honesty Guardrail Test) -->
<section class="team-grid">
  <h1>Meet Our Stylists</h1>
  <div class="staff-card"><h3>Chloe Bennett — Senior Colorist</h3><p>Chloe loves balayage and lived-in blondes.</p></div>
  <div class="staff-card"><h3>Tyler Gomez — Stylist &amp; Educator</h3><p>Tyler specializes in curly cuts and shags.</p></div>
  <blockquote class="testimonial">"Best haircut in Austin!" — Sarah M., Verified Client</blockquote>
  <footer>
    <a href="mailto:hello@eastsidecurlbar.com">hello@eastsidecurlbar.com</a>
    <a href="tel:512-771-3029">Front Desk: (512) 771-3029</a>
    <a href="https://book.boulevard.io/eastsidecurlbar">Book on Boulevard</a>
  </footer>
</section>`
      },
      jsonld_traps: {
        url: 'https://camelbackcoolingpros.com/about-us',
        html: `<!-- Sample 4: JSON-LD schema.org/LocalBusiness + Heavy Asset/Sentry Trap Torture -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Camelback Cooling & Plumbing",
  "telephone": "(602) 518-7740",
  "email": "dispatch@camelbackcoolingpros.com",
  "founder": {
    "@type": "Person",
    "name": "Devon Callahan",
    "jobTitle": "Founder & CEO"
  }
}
<\/script>
<div class="bio">
  <p>Devon Callahan, Founder &amp; CEO of Camelback Cooling &amp; Plumbing, personally backs every Phoenix install: devon@camelbackcoolingpros.com.</p>
  <img src="badge@3x.jpg" /> <img src="truck.webp" />
  <span>yourname@example.com</span> <span>noreply@squarespace.com</span>
  <a href="https://servicetitan.com/camelback">Powered by ServiceTitan</a>
</div>`
      }
    };

    function parseRawHtmlLive(rawHtml, sourceUrl) {
      const rootDom = normalizeRootDomain(sourceUrl || 'example.com');
      const decodedEmails = [];
      const blockedTraps = [];
      const phonesFound = [];
      let ownerResolution = {
        found: false,
        fullName: 'Not explicitly named on site',
        firstName: '',
        lastName: '',
        role: 'Unverified (No Explicit Ownership Title Found)',
        evidenceSnippet: 'Honesty Guardrail: No person anchored with an explicit Owner/Founder/Principal title on this page.',
        method: 'Zero-Guessing Guardrail'
      };

      const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let match;
      while ((match = jsonLdRegex.exec(rawHtml)) !== null) {
        try {
          const data = JSON.parse(match[1].trim());
          const founder = data.founder || (Array.isArray(data.founders) ? data.founders[0] : null);
          if (founder && founder.name) {
            const parts = founder.name.trim().split(/\s+/);
            ownerResolution = {
              found: true,
              fullName: founder.name.trim(),
              firstName: parts[0] || '',
              lastName: parts.slice(1).join(' ') || '',
              role: founder.jobTitle || 'Founder',
              evidenceSnippet: `JSON-LD schema.org/LocalBusiness founder: "${founder.name} — ${founder.jobTitle || 'Founder'}"`,
              method: 'JSON-LD Structured Schema'
            };
          }
          if (data.email) {
            const v = validateAndFilterEmail(data.email);
            if (v.valid) decodedEmails.push({ email: v.email, source: 'JSON-LD Schema' });
          }
          if (data.telephone) {
            const pv = normalizeAndValidatePhone(data.telephone, 'JSON-LD telephone');
            if (pv.valid) phonesFound.push(pv);
          }
        } catch (e) {}
      }

      const cfRegex = /data-cfemail=["']([0-9a-fA-F]+)["']/g;
      while ((match = cfRegex.exec(rawHtml)) !== null) {
        const dec = decodeCfEmail(match[1]);
        const v = validateAndFilterEmail(dec);
        if (v.valid) {
          decodedEmails.push({ email: v.email, source: `Cloudflare data-cfemail XOR (${match[1].slice(0, 10)}...)` });
        }
      }

      const deobText = deobfuscateTextEmails(rawHtml);
      const emailScanRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,12}/g;
      while ((match = emailScanRegex.exec(deobText)) !== null) {
        const rawCandidate = match[0];
        const v = validateAndFilterEmail(rawCandidate);
        if (v.valid) {
          if (!decodedEmails.some(e => e.email === v.email)) {
            const srcLabel = rawHtml.includes(rawCandidate) ? 'DOM / Hydration JSON' : 'De-Obfuscated Entity / [at]';
            decodedEmails.push({ email: v.email, source: srcLabel });
          }
        } else {
          if (!blockedTraps.includes(v.reason)) blockedTraps.push(v.reason);
        }
      }

      const plainText = rawHtml.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!ownerResolution.found) {
        const rolePattern = /(Master Stylist\s*&\s*Owner|Lead DDS\s*&\s*Owner|Lead MD\s*&\s*Medical Director|Practice Owner|Founder\s*&\s*CEO|Co-Founder\s*&\s*Owner|Managing Partner|Owner|Founder|Co-Owner|Principal|CEO)/i;
        const nameRoleRegex = new RegExp(`([A-Z][a-z]+\\s+[A-Z][a-z]+)\\s*(?:,|—|-|is\\s+the)?\\s*${rolePattern.source}`, 'i');
        const nrMatch = plainText.match(nameRoleRegex);
        if (nrMatch) {
          const fullName = nrMatch[1].trim();
          const roleTitle = nrMatch[2].trim();
          const parts = fullName.split(/\s+/);
          const idx = plainText.indexOf(nrMatch[0]);
          const snippet = plainText.slice(Math.max(0, idx - 25), Math.min(plainText.length, idx + 115)).trim();
          ownerResolution = {
            found: true,
            fullName,
            firstName: parts[0] || '',
            lastName: parts.slice(1).join(' ') || '',
            role: roleTitle,
            evidenceSnippet: snippet,
            method: 'Proximity Role-Anchored DOM Text'
          };
        }
      }

      const phoneScanRegex = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g;
      while ((match = phoneScanRegex.exec(plainText)) !== null) {
        const idx = match.index;
        const ctx = plainText.slice(Math.max(0, idx - 25), Math.min(plainText.length, idx + 30));
        const pv = normalizeAndValidatePhone(match[0], ctx);
        if (pv.valid) {
          if (!phonesFound.some(p => p.e164 === pv.e164)) phonesFound.push(pv);
        } else {
          blockedTraps.push(pv.reason);
        }
      }

      const techCandidates = ['Vagaro', 'Boulevard', 'Square Appointments', 'Acuity', 'Calendly', 'Mindbody', 'Toast', 'NexHealth', 'ServiceTitan', 'JaneApp', 'GlossGenius'];
      const detectedTech = techCandidates.filter(t => new RegExp(t.split(' ')[0], 'i').test(rawHtml));

      const classifiedEmails = decodedEmails.map(item => ({
        ...item,
        tier: classifyEmailTier(item.email, ownerResolution.firstName, ownerResolution.lastName)
      })).sort((a, b) => (a.tier === 'Direct' ? -1 : 1));

      return {
        sourceUrl,
        rootDom,
        ownerResolution,
        classifiedEmails,
        phonesFound,
        blockedTraps,
        detectedTech
      };
    }

    // User-entered HTML in the parser lab must be displayed as text, never executed.
    const escapeLabHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));

    function renderLiveParseLabOutput() {
      const htmlInput = document.getElementById('rawHtmlTestInput')?.value || '';
      const urlInput = document.getElementById('rawHtmlSourceUrl')?.value || 'https://example-local.com/our-story';
      const res = parseRawHtmlLive(htmlInput, urlInput);
      const panel = document.getElementById('liveParseOutputPanel');
      if (!panel) return;

      const emailsHtml = res.classifiedEmails.length
        ? res.classifiedEmails.map(e => `
          <div class="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#e4e0ee] text-xs">
            <div>
              <span class="font-mono font-bold text-[#282440]">${escapeLabHtml(e.email)}</span>
              <span class="block text-[10px] text-[#77718f]">Source: ${escapeLabHtml(e.source)}</span>
            </div>
            <span class="px-2.5 py-0.5 rounded-md font-bold text-[10px] ${e.tier === 'Direct' ? 'bg-[#ddf3ed] text-[#245d56]' : 'bg-[#e7e2ff] text-[#51449d]'}">${escapeLabHtml(e.tier)} Email</span>
          </div>`).join('')
        : `<div class="text-xs text-[#77718f] italic">No valid emails found after trap filtering.</div>`;

      const phonesHtml = res.phonesFound.length
        ? res.phonesFound.map(p => `
          <div class="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#e4e0ee] text-xs">
            <div>
              <span class="font-mono font-bold text-[#282440]">${escapeLabHtml(p.display)}</span>
              <span class="ml-2 font-mono text-[11px] text-[#245d56] font-bold">${escapeLabHtml(p.e164)}</span>
            </div>
            <span class="px-2.5 py-0.5 rounded-md text-[10px] bg-[#f0edfa] text-[#595574] font-semibold">${escapeLabHtml(p.lineTier)}</span>
          </div>`).join('')
        : `<div class="text-xs text-[#77718f] italic">No valid phone numbers found.</div>`;

      const trapsHtml = res.blockedTraps.length
        ? res.blockedTraps.map(t => `<span class="px-2.5 py-0.5 rounded-md bg-[#fbe6ee] text-[#9b4d6b] font-mono text-[10px] font-semibold">${escapeLabHtml(t)}</span>`).join('')
        : `<span class="text-xs text-[#77718f]">None triggered</span>`;

      panel.innerHTML = `
        <div class="flex items-center justify-between border-b border-[#e4e0ee] pb-3">
          <div>
            <span class="text-[10px] font-bold uppercase text-[#6457e9]">Live Extraction Output</span>
            <h4 class="text-sm font-bold text-[#282440] font-mono">${escapeLabHtml(res.sourceUrl)}</h4>
          </div>
          <span class="px-2.5 py-0.5 rounded-md bg-[#ddf3ed] text-[#245d56] font-mono text-[10px] font-bold">Root: ${escapeLabHtml(res.rootDom)}</span>
        </div>

        <div class="p-3.5 rounded-xl bg-white border border-[#e4e0ee] space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold uppercase text-[#77718f]">Zero-Guessing Owner Resolution</span>
            <span class="px-2.5 py-0.5 rounded-md text-[10px] font-bold ${res.ownerResolution.found ? 'bg-[#ddf3ed] text-[#245d56]' : 'bg-[#fff1d8] text-[#736139]'}">${escapeLabHtml(res.ownerResolution.role)}</span>
          </div>
          <div class="text-sm font-bold ${res.ownerResolution.found ? 'text-[#282440]' : 'text-[#736139] italic'}">${escapeLabHtml(res.ownerResolution.fullName)}</div>
          <div class="text-[11px] text-[#595574] italic bg-[#faf9ff] p-2.5 rounded-lg border border-[#f0edfa]">
            "${escapeLabHtml(res.ownerResolution.evidenceSnippet)}"
          </div>
        </div>

        <div class="space-y-1.5">
          <div class="text-[10px] font-bold uppercase text-[#77718f]">De-Obfuscated &amp; Tier-Classified Emails (${res.classifiedEmails.length})</div>
          <div class="space-y-1.5">${emailsHtml}</div>
        </div>

        <div class="space-y-1.5">
          <div class="text-[10px] font-bold uppercase text-[#77718f]">Normalized E.164 Phone Numbers (${res.phonesFound.length})</div>
          <div class="space-y-1.5">${phonesHtml}</div>
        </div>

        <div class="space-y-1.5">
          <div class="text-[10px] font-bold uppercase text-[#9b4d6b]">Blocked False Positives &amp; Platform Traps (${res.blockedTraps.length})</div>
          <div class="flex flex-wrap gap-1.5">${trapsHtml}</div>
        </div>

        <div class="pt-2.5 border-t border-[#e4e0ee] flex items-center justify-between text-xs">
          <span class="text-[#77718f]">Detected Booking / Tech Signals:</span>
          <span class="font-bold text-[#65439c]">${res.detectedTech.length ? res.detectedTech.join(', ') : 'None detected'}</span>
        </div>
      `;
    }

    // =========================================================================
    // 9. SPLIT-FIELD 14-COLUMN CRM CSV EXPORT (PILLAR 6)
    // =========================================================================
    function buildCrmCsvString() {
      const headers = [
        'Business Name',
        'Owner Full Name',
        'Owner First Name',
        'Owner Last Name',
        'Verified Role/Title',
        'Primary Email',
        'Email Type (Direct/Generic)',
        'Secondary Emails',
        'Phone Number (E.164 Format)',
        'Website URL',
        'Source Page URL',
        'Verbatim Evidence Snippet',
        'Detected Booking/Tech Tool',
        'Search Query Used'
      ];

      const escapeCsvCell = (val) => {
        const safe = String(val ?? '');
        const guarded = /^[\s]*[=+@\-]/.test(safe) ? '\'' + safe : safe;
        const s = guarded.replace(/"/g, '""');
        return `"${s}"`;
      };

      const rows = getFilteredStreamedLeads().map(l => [
        l.bizName,
        l.ownerFullName,
        l.ownerFirstName,
        l.ownerLastName,
        l.verifiedRole,
        l.primaryEmail,
        l.emailTier,
        l.secondaryEmails.join('; '),
        l.phoneE164,
        l.websiteUrl,
        l.sourcePageUrl,
        l.evidenceSnippet,
        l.bookingTool,
        l.searchQueryUsed
      ].map(escapeCsvCell).join(','));

      return [headers.map(escapeCsvCell).join(','), ...rows].join('\n');
    }

    function downloadCrmCsv() {
      const csv = buildCrmCsvString();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const slug = appState.currentQuery.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      link.href = url;
      link.setAttribute('download', `leadextract-me-pro-${slug}-${appState.streamedLeads.length}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(`Downloaded ${getFilteredStreamedLeads().length} sample leads as a 14-column CSV.`);
    }

    // =========================================================================
    // 10. MODALS & INTERACTIVE EVENT WIRING
    // =========================================================================
    function openProvenanceModal(leadId) {
      const lead = appState.streamedLeads.find(l => l.id === leadId);
      if (!lead) return;
      document.getElementById('modalBizName').textContent = `${lead.bizName} (#${lead.index})`;
      document.getElementById('modalBizDomain').textContent = `Source Subpage: ${lead.sourcePageUrl}`;

      const body = document.getElementById('modalProvenanceBody');
      body.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="p-3.5 rounded-xl bg-[#faf9ff] border border-[#e4e0ee]">
            <div class="text-[10px] font-bold uppercase text-[#77718f]">Owner Resolution &amp; Role Anchor</div>
            <div class="text-sm font-bold text-[#282440] mt-1">${lead.ownerFullName}</div>
            <div class="text-xs text-[#245d56] font-bold mt-0.5">${lead.verifiedRole}</div>
          </div>
          <div class="p-3.5 rounded-xl bg-[#faf9ff] border border-[#e4e0ee]">
            <div class="text-[10px] font-bold uppercase text-[#77718f]">Contact Classification &amp; E.164</div>
            <div class="text-xs font-mono font-bold text-[#282440] mt-1">${lead.primaryEmail} <span class="text-[#6457e9]">(${lead.emailTier})</span></div>
            <div class="text-xs font-mono text-[#595574] mt-0.5">${lead.phoneDisplay} → <span class="text-[#245d56] font-bold">${lead.phoneE164}</span></div>
          </div>
        </div>

        <div class="p-4 rounded-xl bg-[#ddf3ed]/50 border border-[#bde1d6] space-y-1">
          <div class="text-[10px] font-bold uppercase text-[#245d56]">Verbatim 10–20 Word Evidence Snippet (${lead.sourcePageUrl})</div>
          <p class="text-sm text-[#282440] italic">"${lead.evidenceSnippet}"</p>
        </div>

        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold uppercase text-[#77718f]">Captured Raw Subpage HTML &amp; De-Obfuscation Trace</span>
            <button type="button" id="btnLoadIntoLiveLab" data-id="${lead.id}" class="text-xs font-bold text-[#6457e9] hover:underline">
              Open in Live Parser Lab →
            </button>
          </div>
          <pre class="p-4 rounded-xl bg-[#faf9ff] border border-[#e4e0ee] font-mono text-[11px] text-[#282440] overflow-x-auto leading-relaxed">${lead.rawHtmlSnippet.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
        </div>
      `;

      document.getElementById('provenanceModal').classList.remove('hidden');

      const loadBtn = document.getElementById('btnLoadIntoLiveLab');
      if (loadBtn) {
        loadBtn.addEventListener('click', () => {
          document.getElementById('provenanceModal').classList.add('hidden');
          document.getElementById('rawHtmlSourceUrl').value = lead.sourcePageUrl;
          document.getElementById('rawHtmlTestInput').value = lead.rawHtmlSnippet;
          switchMainTab('liveInspector');
          renderLiveParseLabOutput();
        });
      }
    }

    function renderSavedVaultModalList() {
      const listEl = document.getElementById('savedVaultList');
      if (!listEl) return;
      const entries = Object.entries(appState.savedVaultDomains);
      if (entries.length === 0) {
        listEl.innerHTML = `<div class="p-6 text-center text-[#77718f]">No domains saved in browser storage yet. Click "Save" on any card or "+ Save 12 Sample Leads to Storage Vault" to test Cross-Session Deduplication.</div>`;
        return;
      }
      listEl.innerHTML = entries.map(([dom, meta]) => `
        <div class="flex items-center justify-between p-3 rounded-xl bg-[#faf9ff] border border-[#e4e0ee]">
          <div>
            <div class="font-bold text-[#282440]">${meta.bizName}</div>
            <div class="font-mono text-[11px] text-[#6457e9]">${dom} · Owner: ${meta.ownerFullName}</div>
          </div>
          <button type="button" data-remove-vault="${dom}" class="px-3 py-1 rounded-lg bg-white hover:bg-[#fbe6ee] text-[#595574] hover:text-[#9b4d6b] border border-[#d6d0e7] text-[11px] font-semibold transition">
            Remove
          </button>
        </div>
      `).join('');
    }

    function switchMainTab(tabName) {
      appState.activeTab = tabName;
      const views = {
        leadEngine: document.getElementById('viewLeadEngine'),
        queueLog: document.getElementById('viewQueueLog'),
        liveInspector: document.getElementById('viewLiveInspector'),
        architecture: document.getElementById('viewArchitecture')
      };
      const buttons = {
        leadEngine: document.getElementById('tabBtnLeadEngine'),
        queueLog: document.getElementById('tabBtnQueueLog'),
        liveInspector: document.getElementById('tabBtnLiveInspector'),
        architecture: document.getElementById('tabBtnArchitecture')
      };

      Object.keys(views).forEach(k => {
        if (k === tabName) {
          views[k].classList.remove('hidden');
          buttons[k].className = 'shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all bg-white text-[#6457e9] shadow-sm flex items-center gap-1.5';
        } else {
          views[k].classList.add('hidden');
          buttons[k].className = 'shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all text-[#595574] hover:text-[#282440] flex items-center gap-1.5';
        }
      });
    }

    window.addEventListener('DOMContentLoaded', () => {
      loadSavedVault();
      renderBlocklistPills();

      document.getElementById('rawHtmlSourceUrl').value = SAMPLE_HTML_PAYLOADS.cfemail_wix.url;
      document.getElementById('rawHtmlTestInput').value = SAMPLE_HTML_PAYLOADS.cfemail_wix.html;
      renderLiveParseLabOutput();

      // Default 150 leads loaded immediately on startup
      executeLeadBatch(true);

      document.getElementById('tabBtnLeadEngine').addEventListener('click', () => switchMainTab('leadEngine'));
      document.getElementById('tabBtnQueueLog').addEventListener('click', () => {
        renderSerpQueueLog();
        switchMainTab('queueLog');
      });
      document.getElementById('tabBtnLiveInspector').addEventListener('click', () => switchMainTab('liveInspector'));
      document.getElementById('tabBtnArchitecture').addEventListener('click', () => switchMainTab('architecture'));

      document.getElementById('presetMarketSelect').addEventListener('change', (e) => {
        const val = e.target.value;
        document.getElementById('searchQueryInput').value = val === 'all-trades-mega' ? 'All Local Trades Combined' : val;
        executeLeadBatch(false);
      });

      // Sync Preset Dropdown <-> Custom Number Input
      document.getElementById('batchTargetSelect').addEventListener('change', (e) => {
        const val = e.target.value;
        const customInp = document.getElementById('customBatchInput');
        if (val === 'custom') {
          customInp.focus();
          customInp.select();
        } else {
          customInp.value = val;
        }
      });

      document.getElementById('customBatchInput').addEventListener('input', (e) => {
        const v = e.target.value.trim();
        const selectEl = document.getElementById('batchTargetSelect');
        const matchingOption = Array.from(selectEl.options).find(opt => opt.value === v);
        selectEl.value = matchingOption ? v : 'custom';
      });

      document.getElementById('customBatchInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          executeLeadBatch(false);
        }
      });

      document.getElementById('btnRunScrape').addEventListener('click', () => {
        switchMainTab('leadEngine');
        executeLeadBatch(false);
      });

      document.getElementById('searchQueryInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          executeLeadBatch(false);
        }
      });

      document.getElementById('skipSavedToggle').addEventListener('change', () => {
        executeLeadBatch(true);
      });

      document.getElementById('btnSaveAllCurrent').addEventListener('click', () => {
        const subset = appState.streamedLeads.slice(0, 12);
        subset.forEach(l => {
          appState.savedVaultDomains[l.rootDomain] = {
            bizName: l.bizName,
            ownerFullName: l.ownerFullName,
            savedAt: new Date().toISOString()
          };
        });
        persistSavedVault();
        renderFilteredLeadsView();
        showToast(`Saved 12 domains to Vault. Toggle "Skip previously saved" to see auto-replenishment!`);
      });

      ['leadFilterInput', 'ownerFilterSelect', 'emailTierFilterSelect', 'techFilterSelect'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.addEventListener('input', renderFilteredLeadsView);
          el.addEventListener('change', renderFilteredLeadsView);
        }
      });

      document.getElementById('btnViewCards').addEventListener('click', () => {
        appState.viewMode = 'cards';
        document.getElementById('btnViewCards').className = 'px-3 py-1 rounded-lg text-xs font-bold bg-white text-[#6457e9] shadow-sm transition';
        document.getElementById('btnViewTable').className = 'px-3 py-1 rounded-lg text-xs font-semibold text-[#595574] hover:text-[#282440] transition';
        renderFilteredLeadsView();
      });
      document.getElementById('btnViewTable').addEventListener('click', () => {
        appState.viewMode = 'table';
        document.getElementById('btnViewTable').className = 'px-3 py-1 rounded-lg text-xs font-bold bg-white text-[#6457e9] shadow-sm transition';
        document.getElementById('btnViewCards').className = 'px-3 py-1 rounded-lg text-xs font-semibold text-[#595574] hover:text-[#282440] transition';
        renderFilteredLeadsView();
      });

      const handleLeadContainerClick = (e) => {
        const saveBtn = e.target.closest('[data-action="save-lead"]');
        if (saveBtn) {
          const dom = saveBtn.getAttribute('data-domain');
          const lead = appState.streamedLeads.find(l => l.rootDomain === dom);
          if (appState.savedVaultDomains[dom]) {
            delete appState.savedVaultDomains[dom];
            showToast(`Removed ${dom} from Saved Vault.`, 'amber');
          } else if (lead) {
            appState.savedVaultDomains[dom] = {
              bizName: lead.bizName,
              ownerFullName: lead.ownerFullName,
              savedAt: new Date().toISOString()
            };
            showToast(`Saved ${lead.bizName} (${dom}) to Vault.`);
          }
          persistSavedVault();
          renderFilteredLeadsView();
          return;
        }

        const inspectBtn = e.target.closest('[data-action="inspect-provenance"]');
        if (inspectBtn) {
          openProvenanceModal(inspectBtn.getAttribute('data-id'));
        }
      };

      document.getElementById('leadsCardGrid').addEventListener('click', handleLeadContainerClick);
      document.getElementById('leadsTableBody').addEventListener('click', handleLeadContainerClick);

      document.getElementById('btnCloseProvenanceModal').addEventListener('click', () => {
        document.getElementById('provenanceModal').classList.add('hidden');
      });

      document.getElementById('serpLogFilterSelect').addEventListener('change', renderSerpQueueLog);

      document.querySelectorAll('.sample-html-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = btn.getAttribute('data-sample');
          const sample = SAMPLE_HTML_PAYLOADS[key];
          if (sample) {
            document.getElementById('rawHtmlSourceUrl').value = sample.url;
            document.getElementById('rawHtmlTestInput').value = sample.html;
            renderLiveParseLabOutput();
          }
        });
      });
      document.getElementById('btnExecuteLiveParse').addEventListener('click', renderLiveParseLabOutput);

      document.getElementById('btnAddBlockDomain').addEventListener('click', () => {
        const inp = document.getElementById('customBlockDomainInput');
        const dom = normalizeRootDomain(inp.value.trim());
        if (/^(?=.{3,253}$)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(dom)) {
          if (!appState.customBlockedDomains.includes(dom)) {
            appState.customBlockedDomains.push(dom);
            renderBlocklistPills();
            showToast(`Added ${dom} to Pre-Scrape Blocklist.`);
          }
          inp.value = '';
        }
      });

      // All Extract CSV buttons trigger downloadCrmCsv
      document.getElementById('btnExportCsvTop').addEventListener('click', downloadCrmCsv);
      document.getElementById('btnExtractCsvHero').addEventListener('click', downloadCrmCsv);
      document.getElementById('btnExtractCsvToolbar').addEventListener('click', downloadCrmCsv);

      document.getElementById('btnPreviewCsvModal').addEventListener('click', () => {
        document.getElementById('csvRawPreviewTextarea').value = buildCrmCsvString();
        document.getElementById('csvPreviewModal').classList.remove('hidden');
      });
      document.getElementById('btnCloseCsvModal').addEventListener('click', () => {
        document.getElementById('csvPreviewModal').classList.add('hidden');
      });
      document.getElementById('btnDownloadCsvModal').addEventListener('click', downloadCrmCsv);
      document.getElementById('btnCopyCsvClipboard').addEventListener('click', () => {
        const ta = document.getElementById('csvRawPreviewTextarea');
        ta.select();
        try {
          document.execCommand('copy');
          showToast('Copied 14-column CRM CSV to clipboard.');
        } catch (err) {}
      });

      document.getElementById('btnOpenSavedVault').addEventListener('click', () => {
        renderSavedVaultModalList();
        document.getElementById('savedVaultModal').classList.remove('hidden');
      });
      document.getElementById('btnCloseSavedVault').addEventListener('click', () => {
        document.getElementById('savedVaultModal').classList.add('hidden');
      });
      document.getElementById('btnCloseSavedVaultFooter').addEventListener('click', () => {
        document.getElementById('savedVaultModal').classList.add('hidden');
      });
      document.getElementById('btnClearSavedVault').addEventListener('click', () => {
        appState.savedVaultDomains = {};
        persistSavedVault();
        renderSavedVaultModalList();
        executeLeadBatch(true);
        showToast('Cleared Saved Business Vault.', 'amber');
      });
      document.getElementById('savedVaultList').addEventListener('click', (e) => {
        const rmBtn = e.target.closest('[data-remove-vault]');
        if (rmBtn) {
          const dom = rmBtn.getAttribute('data-remove-vault');
          delete appState.savedVaultDomains[dom];
          persistSavedVault();
          renderSavedVaultModalList();
          renderFilteredLeadsView();
        }
      });
    });
  
