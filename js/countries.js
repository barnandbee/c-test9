// Country names used for autocomplete and for checking that a guess is a real
// country (so a typo doesn't cost the player a guess).
window.VENN_COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda",
  "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain",
  "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia",
  "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso",
  "Burundi", "Cambodia", "Cameroon", "Canada", "Cape Verde", "Central African Republic",
  "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba",
  "Cyprus", "Czechia", "Democratic Republic of the Congo", "Denmark", "Djibouti",
  "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea",
  "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon",
  "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea",
  "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hong Kong", "Hungary", "Iceland", "India",
  "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast", "Jamaica",
  "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania",
  "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta",
  "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova",
  "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia",
  "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria",
  "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine",
  "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia",
  "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe",
  "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore",
  "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea",
  "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland",
  "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga",
  "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda",
  "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay",
  "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia",
  "Zimbabwe"
];

// Alternative spellings -> the name used above. Keys and values are compared
// after normalising (lower case, no accents or punctuation).
window.VENN_COUNTRY_ALIASES = {
  "uk": "United Kingdom", "great britain": "United Kingdom", "britain": "United Kingdom",
  "england": "United Kingdom", "us": "United States", "usa": "United States",
  "america": "United States", "united states of america": "United States",
  "uae": "United Arab Emirates", "czech republic": "Czechia", "holland": "Netherlands",
  "the netherlands": "Netherlands", "cote d ivoire": "Ivory Coast", "burma": "Myanmar",
  "swaziland": "Eswatini", "east timor": "Timor-Leste", "drc": "Democratic Republic of the Congo",
  "dr congo": "Democratic Republic of the Congo", "republic of the congo": "Congo",
  "korea": "South Korea", "republic of korea": "South Korea", "cabo verde": "Cape Verde",
  "turkiye": "Turkey", "macedonia": "North Macedonia", "persia": "Iran",
  "viet nam": "Vietnam", "lao pdr": "Laos", "russian federation": "Russia",
  "the gambia": "Gambia", "vatican": "Vatican City", "ksa": "Saudi Arabia",
  "nz": "New Zealand", "png": "Papua New Guinea", "bosnia": "Bosnia and Herzegovina",
  "trinidad": "Trinidad and Tobago", "st lucia": "Saint Lucia",
  "st kitts and nevis": "Saint Kitts and Nevis"
};
