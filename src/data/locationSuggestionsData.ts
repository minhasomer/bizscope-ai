
// Shared location suggestions used by Hero and OpportunityExplorer.
// Covers top US cities, major suburbs/counties, and common ZIP codes.

export const locationSuggestions: string[] = [
  // Top US Cities
  'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Phoenix, AZ', 'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA', 'Dallas, TX', 'San Jose, CA',
  'Austin, TX', 'Jacksonville, FL', 'Fort Worth, TX', 'Columbus, OH', 'Charlotte, NC', 'San Francisco, CA', 'Indianapolis, IN', 'Seattle, WA', 'Denver, CO', 'Washington, DC',
  'Boston, MA', 'El Paso, TX', 'Nashville, TN', 'Detroit, MI', 'Oklahoma City, OK', 'Portland, OR', 'Las Vegas, NV', 'Memphis, TN', 'Louisville, KY', 'Baltimore, MD',
  'Milwaukee, WI', 'Albuquerque, NM', 'Tucson, AZ', 'Fresno, CA', 'Sacramento, CA', 'Mesa, AZ', 'Kansas City, MO', 'Atlanta, GA', 'Long Beach, CA', 'Colorado Springs, CO',
  'Raleigh, NC', 'Miami, FL', 'Virginia Beach, VA', 'Omaha, NE', 'Oakland, CA', 'Minneapolis, MN', 'Tulsa, OK', 'Arlington, TX', 'Tampa, FL', 'New Orleans, LA',
  'Wichita, KS', 'Cleveland, OH', 'Bakersfield, CA', 'Aurora, CO', 'Anaheim, CA', 'Honolulu, HI', 'Santa Ana, CA', 'Corpus Christi, TX', 'Riverside, CA', 'Lexington, KY', 'Stockton, CA',

  // Major Suburbs & Regions
  'Gurnee, IL', 'Libertyville, IL', 'Vernon Hills, IL', 'Naperville, IL', 'Evanston, IL', 'Schaumburg, IL', 'Aurora, IL', 'Joliet, IL', 'Elgin, IL', 'Waukegan, IL', 'Cicero, IL', 'Arlington Heights, IL',
  'Bolingbrook, IL', 'Skokie, IL', 'Des Plaines, IL', 'Orland Park, IL', 'Tinley Park, IL', 'Oak Park, IL', 'Downers Grove, IL', 'Mount Prospect, IL', 'Wheaton, IL',
  'Scottsdale, AZ', 'Plano, TX', 'Irvine, CA', 'Newark, NJ', 'Jersey City, NJ', 'St. Petersburg, FL', 'Chula Vista, CA', 'Orlando, FL', 'Chandler, AZ', 'Laredo, TX',
  'Madison, WI', 'Durham, NC', 'Lubbock, TX', 'Garland, TX', 'Glendale, AZ', 'Hialeah, FL', 'Reno, NV', 'Baton Rouge, LA', 'Chesapeake, VA', 'Gilbert, AZ',
  'Santa Monica, CA', 'Pasadena, CA', 'Burbank, CA', 'Compton, CA', 'Inglewood, CA', 'Torrance, CA',
  'The Woodlands, TX', 'Sugar Land, TX', 'Katy, TX', 'Pearland, TX', 'Frisco, TX', 'McKinney, TX', 'Allen, TX',
  'Marietta, GA', 'Alpharetta, GA', 'Sandy Springs, GA', 'Roswell, GA',
  'Cambridge, MA', 'Somerville, MA', 'Quincy, MA', 'Framingham, MA',
  'Bellevue, WA', 'Tacoma, WA', 'Redmond, WA', 'Kirkland, WA',
  'Addison, TX', 'Carrollton, TX', 'Irving, TX', 'Mesquite, TX',
  'Henderson, NV', 'North Las Vegas, NV', 'Summerlin, NV',
  'Tempe, AZ', 'Peoria, AZ', 'Surprise, AZ', 'Goodyear, AZ', 'Avondale, AZ',
  'Clearwater, FL', 'Sarasota, FL', 'Fort Lauderdale, FL', 'Pembroke Pines, FL', 'Hollywood, FL',
  'Boca Raton, FL', 'Coral Springs, FL', 'Miramar, FL', 'Pompano Beach, FL',
  'Round Rock, TX', 'Cedar Park, TX', 'Georgetown, TX', 'Kyle, TX',

  // Counties
  'Cook County, IL', 'Lake County, IL', 'DuPage County, IL', 'Will County, IL',
  'Los Angeles County, CA', 'Harris County, TX', 'Maricopa County, AZ', 'San Diego County, CA', 'Orange County, CA', 'Miami-Dade County, FL', 'Dallas County, TX',
  'King County, WA', 'Queens County, NY', 'Clark County, NV', 'Tarrant County, TX', 'Bexar County, TX', 'Broward County, FL', 'Wayne County, MI', 'Santa Clara County, CA',
  'Riverside County, CA', 'San Bernardino County, CA', 'Middlesex County, MA', 'Collin County, TX',

  // ZIP Codes
  '60031', '60048', '60064', '60085', '60087', '60046', '60030', // Lake County, IL
  '10001', '10002', '10003', '10004', '10005', // NYC
  '90210', '90001', '90002', '90028', '90069', // LA
  '60601', '60602', '60611', '60614', '60647', // Chicago Loop/North Side
  '77001', '77002', '77005', '77019', // Houston
  '85001', '85002', '85003', // Phoenix
  '33101', '33139', '33131', // Miami
  '94102', '94103', '94110', // SF
  '75001', '75002', '75006', '75007', // Dallas suburbs
  '30301', '30309', '30318', // Atlanta
  '98101', '98102', '98103', // Seattle
  '80201', '80202', '80203', // Denver
  '73301', '73344', '73301', // Austin
];

// Curated defaults shown when the location field is focused but empty
export const defaultLocationSuggestions: string[] = [
  'Gurnee, IL', 'Libertyville, IL', 'Vernon Hills, IL', 'Lake County, IL',
  'Chicago, IL', 'Naperville, IL', 'Schaumburg, IL', 'Milwaukee, WI',
  'Dallas, TX', 'Houston, TX', 'Phoenix, AZ',
];

export function filterLocationSuggestions(input: string): string[] {
  if (!input.trim()) return defaultLocationSuggestions;
  return locationSuggestions
    .filter(item => item.toLowerCase().includes(input.toLowerCase()))
    .slice(0, 10);
}
