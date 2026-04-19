'use client';

import { useState } from 'react';

type RosterEntry = {
  bowlerID: number;
  bowlerName: string;
  isActive: boolean;
  seasonID: number;
};

const ROSTER: RosterEntry[] = [
  // Season 1 - Spring 2007
  { bowlerID: 140, bowlerName: 'Dan McCleary', isActive: false, seasonID: 1 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 1 },
  { bowlerID: 391, bowlerName: 'Kyle Hanlin', isActive: false, seasonID: 1 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 1 },
  { bowlerID: 509, bowlerName: 'Paul Branecky', isActive: false, seasonID: 1 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 1 },
  // Season 2 - Fall 2008
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 2 },
  { bowlerID: 391, bowlerName: 'Kyle Hanlin', isActive: false, seasonID: 2 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 2 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 2 },
  // Season 3 - Spring 2009
  { bowlerID: 25, bowlerName: 'Amy Wilkinson', isActive: false, seasonID: 3 },
  { bowlerID: 176, bowlerName: 'Dmitri Gudgenov', isActive: false, seasonID: 3 },
  { bowlerID: 293, bowlerName: 'Jennifer Hill', isActive: false, seasonID: 3 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 3 },
  { bowlerID: 378, bowlerName: 'Kevin Hicks', isActive: false, seasonID: 3 },
  { bowlerID: 391, bowlerName: 'Kyle Hanlin', isActive: false, seasonID: 3 },
  { bowlerID: 411, bowlerName: 'Linda Klein', isActive: false, seasonID: 3 },
  { bowlerID: 425, bowlerName: 'Mark Edwards', isActive: false, seasonID: 3 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 3 },
  { bowlerID: 567, bowlerName: 'Sergio Chaves', isActive: false, seasonID: 3 },
  // Season 4 - Fall 2009
  { bowlerID: 140, bowlerName: 'Dan McCleary', isActive: false, seasonID: 4 },
  { bowlerID: 188, bowlerName: 'Elizabeth Read', isActive: true, seasonID: 4 },
  { bowlerID: 200, bowlerName: 'Eric Roehrig', isActive: false, seasonID: 4 },
  { bowlerID: 308, bowlerName: 'Jim Gaston', isActive: false, seasonID: 4 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 4 },
  { bowlerID: 391, bowlerName: 'Kyle Hanlin', isActive: false, seasonID: 4 },
  { bowlerID: 411, bowlerName: 'Linda Klein', isActive: false, seasonID: 4 },
  { bowlerID: 425, bowlerName: 'Mark Edwards', isActive: false, seasonID: 4 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 4 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 4 },
  { bowlerID: 561, bowlerName: 'Scott Berrier', isActive: false, seasonID: 4 },
  // Season 5 - Spring 2010
  { bowlerID: 4, bowlerName: 'Adam Braun', isActive: false, seasonID: 5 },
  { bowlerID: 108, bowlerName: 'Charlotte Walton', isActive: false, seasonID: 5 },
  { bowlerID: 188, bowlerName: 'Elizabeth Read', isActive: true, seasonID: 5 },
  { bowlerID: 276, bowlerName: 'Jason Baxter', isActive: false, seasonID: 5 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 5 },
  { bowlerID: 391, bowlerName: 'Kyle Hanlin', isActive: false, seasonID: 5 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 5 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 5 },
  // Season 6 - Fall 2010
  { bowlerID: 140, bowlerName: 'Dan McCleary', isActive: false, seasonID: 6 },
  { bowlerID: 276, bowlerName: 'Jason Baxter', isActive: false, seasonID: 6 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 6 },
  { bowlerID: 391, bowlerName: 'Kyle Hanlin', isActive: false, seasonID: 6 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 6 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 6 },
  // Season 7 - Spring 2011
  { bowlerID: 4, bowlerName: 'Adam Braun', isActive: false, seasonID: 7 },
  { bowlerID: 270, bowlerName: 'James Cartwright', isActive: false, seasonID: 7 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 7 },
  { bowlerID: 391, bowlerName: 'Kyle Hanlin', isActive: false, seasonID: 7 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 7 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 7 },
  // Season 8 - Fall 2011
  { bowlerID: 116, bowlerName: 'Chris Toenes', isActive: false, seasonID: 8 },
  { bowlerID: 282, bowlerName: 'Jay Lowe', isActive: false, seasonID: 8 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 8 },
  { bowlerID: 391, bowlerName: 'Kyle Hanlin', isActive: false, seasonID: 8 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 8 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 8 },
  // Season 9 - Spring 2012
  { bowlerID: 188, bowlerName: 'Elizabeth Read', isActive: true, seasonID: 9 },
  { bowlerID: 276, bowlerName: 'Jason Baxter', isActive: false, seasonID: 9 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 9 },
  { bowlerID: 391, bowlerName: 'Kyle Hanlin', isActive: false, seasonID: 9 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 9 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 9 },
  // Season 10 - Fall 2012
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 10 },
  { bowlerID: 391, bowlerName: 'Kyle Hanlin', isActive: false, seasonID: 10 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 10 },
  { bowlerID: 498, bowlerName: 'Nicole Hogan', isActive: false, seasonID: 10 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 10 },
  { bowlerID: 580, bowlerName: 'Stefanie Conrad', isActive: false, seasonID: 10 },
  // Season 11 - Spring 2013
  { bowlerID: 18, bowlerName: 'Alyson West', isActive: false, seasonID: 11 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 11 },
  { bowlerID: 391, bowlerName: 'Kyle Hanlin', isActive: false, seasonID: 11 },
  { bowlerID: 399, bowlerName: 'Lauren Reynolds', isActive: false, seasonID: 11 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 11 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 11 },
  { bowlerID: 552, bowlerName: 'Sandra Good', isActive: false, seasonID: 11 },
  // Season 12 - Fall 2013
  { bowlerID: 197, bowlerName: 'Erda Goknar', isActive: false, seasonID: 12 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 12 },
  { bowlerID: 391, bowlerName: 'Kyle Hanlin', isActive: false, seasonID: 12 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 12 },
  { bowlerID: 501, bowlerName: 'Nora Onufur', isActive: false, seasonID: 12 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 12 },
  // Season 13 - Spring 2014
  { bowlerID: 286, bowlerName: 'Jeffrey Petrou', isActive: false, seasonID: 13 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 13 },
  { bowlerID: 341, bowlerName: 'Julie Grundy', isActive: false, seasonID: 13 },
  { bowlerID: 391, bowlerName: 'Kyle Hanlin', isActive: false, seasonID: 13 },
  { bowlerID: 479, bowlerName: 'Mike DePasquale', isActive: true, seasonID: 13 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 13 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 13 },
  // Season 14 - Fall 2014
  { bowlerID: 263, bowlerName: 'Jack McCleary', isActive: false, seasonID: 14 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 14 },
  { bowlerID: 391, bowlerName: 'Kyle Hanlin', isActive: false, seasonID: 14 },
  { bowlerID: 412, bowlerName: 'Lindsey Kronmiller', isActive: false, seasonID: 14 },
  { bowlerID: 435, bowlerName: 'Martin Hall', isActive: true, seasonID: 14 },
  { bowlerID: 444, bowlerName: 'Matt Horne', isActive: false, seasonID: 14 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 14 },
  { bowlerID: 547, bowlerName: 'Ruby Sinreich', isActive: false, seasonID: 14 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 14 },
  // Season 15 - Spring 2015
  { bowlerID: 286, bowlerName: 'Jeffrey Petrou', isActive: false, seasonID: 15 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 15 },
  { bowlerID: 391, bowlerName: 'Kyle Hanlin', isActive: false, seasonID: 15 },
  { bowlerID: 435, bowlerName: 'Martin Hall', isActive: true, seasonID: 15 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 15 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 15 },
  // Season 16 - Fall 2015
  { bowlerID: 230, bowlerName: 'Glenn Boothe', isActive: true, seasonID: 16 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 16 },
  { bowlerID: 391, bowlerName: 'Kyle Hanlin', isActive: false, seasonID: 16 },
  { bowlerID: 435, bowlerName: 'Martin Hall', isActive: true, seasonID: 16 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 16 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 16 },
  // Season 17 - Spring 2016
  { bowlerID: 230, bowlerName: 'Glenn Boothe', isActive: true, seasonID: 17 },
  { bowlerID: 278, bowlerName: 'Jason Jones', isActive: false, seasonID: 17 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 17 },
  { bowlerID: 391, bowlerName: 'Kyle Hanlin', isActive: false, seasonID: 17 },
  { bowlerID: 435, bowlerName: 'Martin Hall', isActive: true, seasonID: 17 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 17 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 17 },
  // Season 18 - Fall 2016
  { bowlerID: 230, bowlerName: 'Glenn Boothe', isActive: true, seasonID: 18 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 18 },
  { bowlerID: 391, bowlerName: 'Kyle Hanlin', isActive: false, seasonID: 18 },
  { bowlerID: 412, bowlerName: 'Lindsey Kronmiller', isActive: false, seasonID: 18 },
  { bowlerID: 435, bowlerName: 'Martin Hall', isActive: true, seasonID: 18 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 18 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 18 },
  // Season 19 - Spring 2017
  { bowlerID: 61, bowlerName: 'Blake Moriarty', isActive: true, seasonID: 19 },
  { bowlerID: 173, bowlerName: 'Derrick Robertson', isActive: false, seasonID: 19 },
  { bowlerID: 230, bowlerName: 'Glenn Boothe', isActive: true, seasonID: 19 },
  { bowlerID: 299, bowlerName: 'Jeremy Kumin', isActive: true, seasonID: 19 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 19 },
  { bowlerID: 391, bowlerName: 'Kyle Hanlin', isActive: false, seasonID: 19 },
  { bowlerID: 412, bowlerName: 'Lindsey Kronmiller', isActive: false, seasonID: 19 },
  { bowlerID: 423, bowlerName: 'Marie Sherr', isActive: true, seasonID: 19 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 19 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 19 },
  // Season 20 - Fall 2017
  { bowlerID: 61, bowlerName: 'Blake Moriarty', isActive: true, seasonID: 20 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 20 },
  { bowlerID: 435, bowlerName: 'Martin Hall', isActive: true, seasonID: 20 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 20 },
  { bowlerID: 536, bowlerName: 'Rob Monahan', isActive: false, seasonID: 20 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 20 },
  // Season 21 - Spring 2018
  { bowlerID: 173, bowlerName: 'Derrick Robertson', isActive: false, seasonID: 21 },
  { bowlerID: 319, bowlerName: 'John Carlson', isActive: false, seasonID: 21 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 21 },
  { bowlerID: 435, bowlerName: 'Martin Hall', isActive: true, seasonID: 21 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 21 },
  { bowlerID: 493, bowlerName: 'Nathaniel Brown', isActive: false, seasonID: 21 },
  { bowlerID: 536, bowlerName: 'Rob Monahan', isActive: false, seasonID: 21 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 21 },
  // Season 22 - Fall 2018
  { bowlerID: 319, bowlerName: 'John Carlson', isActive: false, seasonID: 22 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 22 },
  { bowlerID: 435, bowlerName: 'Martin Hall', isActive: true, seasonID: 22 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 22 },
  { bowlerID: 493, bowlerName: 'Nathaniel Brown', isActive: false, seasonID: 22 },
  { bowlerID: 536, bowlerName: 'Rob Monahan', isActive: false, seasonID: 22 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 22 },
  // Season 23 - Spring 2019
  { bowlerID: 319, bowlerName: 'John Carlson', isActive: false, seasonID: 23 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 23 },
  { bowlerID: 435, bowlerName: 'Martin Hall', isActive: true, seasonID: 23 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 23 },
  { bowlerID: 536, bowlerName: 'Rob Monahan', isActive: false, seasonID: 23 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 23 },
  // Season 24 - Fall 2019
  { bowlerID: 223, bowlerName: 'Gene Bear', isActive: false, seasonID: 24 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 24 },
  { bowlerID: 391, bowlerName: 'Kyle Hanlin', isActive: false, seasonID: 24 },
  { bowlerID: 435, bowlerName: 'Martin Hall', isActive: true, seasonID: 24 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 24 },
  { bowlerID: 536, bowlerName: 'Rob Monahan', isActive: false, seasonID: 24 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 24 },
  // Season 25 - Spring 2020
  { bowlerID: 62, bowlerName: 'Bo Dobrzenski', isActive: false, seasonID: 25 },
  { bowlerID: 109, bowlerName: 'Chelsea Amato', isActive: false, seasonID: 25 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 25 },
  { bowlerID: 435, bowlerName: 'Martin Hall', isActive: true, seasonID: 25 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 25 },
  { bowlerID: 536, bowlerName: 'Rob Monahan', isActive: false, seasonID: 25 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 25 },
  // Season 26 - Fall 2021 (gap: COVID pause)
  { bowlerID: 140, bowlerName: 'Dan McCleary', isActive: false, seasonID: 26 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 26 },
  { bowlerID: 435, bowlerName: 'Martin Hall', isActive: true, seasonID: 26 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 26 },
  { bowlerID: 536, bowlerName: 'Rob Monahan', isActive: false, seasonID: 26 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 26 },
  // Season 27 - Spring 2022
  { bowlerID: 207, bowlerName: 'Erin Biggerstaff', isActive: true, seasonID: 27 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 27 },
  { bowlerID: 391, bowlerName: 'Kyle Hanlin', isActive: false, seasonID: 27 },
  { bowlerID: 435, bowlerName: 'Martin Hall', isActive: true, seasonID: 27 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 27 },
  { bowlerID: 536, bowlerName: 'Rob Monahan', isActive: false, seasonID: 27 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 27 },
  // Season 28 - Fall 2022
  { bowlerID: 107, bowlerName: 'Charlotte Asmuth', isActive: true, seasonID: 28 },
  { bowlerID: 109, bowlerName: 'Chelsea Amato', isActive: false, seasonID: 28 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 28 },
  { bowlerID: 435, bowlerName: 'Martin Hall', isActive: true, seasonID: 28 },
  { bowlerID: 483, bowlerName: 'Mirla del Rosario', isActive: false, seasonID: 28 },
  { bowlerID: 528, bowlerName: 'Rebecca Pattillo', isActive: true, seasonID: 28 },
  { bowlerID: 536, bowlerName: 'Rob Monahan', isActive: false, seasonID: 28 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 28 },
  // Season 29 - Spring 2023
  { bowlerID: 181, bowlerName: 'Dylan Harris', isActive: false, seasonID: 29 },
  { bowlerID: 194, bowlerName: 'Emma Jane Richardson', isActive: true, seasonID: 29 },
  { bowlerID: 220, bowlerName: 'Fred Cooley', isActive: true, seasonID: 29 },
  { bowlerID: 230, bowlerName: 'Glenn Boothe', isActive: true, seasonID: 29 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 29 },
  { bowlerID: 368, bowlerName: 'Keith Walker', isActive: false, seasonID: 29 },
  { bowlerID: 391, bowlerName: 'Kyle Hanlin', isActive: false, seasonID: 29 },
  { bowlerID: 435, bowlerName: 'Martin Hall', isActive: true, seasonID: 29 },
  { bowlerID: 498, bowlerName: 'Nicole Hogan', isActive: false, seasonID: 29 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 29 },
  { bowlerID: 618, bowlerName: 'Vance Woods', isActive: true, seasonID: 29 },
  // Season 30 - Fall 2023
  { bowlerID: 121, bowlerName: 'Christina Manzella', isActive: true, seasonID: 30 },
  { bowlerID: 309, bowlerName: 'Jim Haverkamp', isActive: true, seasonID: 30 },
  { bowlerID: 368, bowlerName: 'Keith Walker', isActive: false, seasonID: 30 },
  { bowlerID: 384, bowlerName: 'Kris Resurreccion', isActive: false, seasonID: 30 },
  { bowlerID: 435, bowlerName: 'Martin Hall', isActive: true, seasonID: 30 },
  { bowlerID: 502, bowlerName: 'Norwood Cheek', isActive: true, seasonID: 30 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 30 },
  // Season 31 - Spring 2024
  { bowlerID: 121, bowlerName: 'Christina Manzella', isActive: true, seasonID: 31 },
  { bowlerID: 230, bowlerName: 'Glenn Boothe', isActive: true, seasonID: 31 },
  { bowlerID: 293, bowlerName: 'Jennifer Hill', isActive: false, seasonID: 31 },
  { bowlerID: 309, bowlerName: 'Jim Haverkamp', isActive: true, seasonID: 31 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 31 },
  { bowlerID: 368, bowlerName: 'Keith Walker', isActive: false, seasonID: 31 },
  { bowlerID: 409, bowlerName: 'Leslie Pierce', isActive: true, seasonID: 31 },
  { bowlerID: 435, bowlerName: 'Martin Hall', isActive: true, seasonID: 31 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 31 },
  // Season 32 - Fall 2024
  { bowlerID: 121, bowlerName: 'Christina Manzella', isActive: true, seasonID: 32 },
  { bowlerID: 225, bowlerName: 'Geoffrey Berry', isActive: true, seasonID: 32 },
  { bowlerID: 309, bowlerName: 'Jim Haverkamp', isActive: true, seasonID: 32 },
  { bowlerID: 368, bowlerName: 'Keith Walker', isActive: false, seasonID: 32 },
  { bowlerID: 435, bowlerName: 'Martin Hall', isActive: true, seasonID: 32 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 32 },
  // Season 33 - Spring 2025
  { bowlerID: 121, bowlerName: 'Christina Manzella', isActive: true, seasonID: 33 },
  { bowlerID: 225, bowlerName: 'Geoffrey Berry', isActive: true, seasonID: 33 },
  { bowlerID: 309, bowlerName: 'Jim Haverkamp', isActive: true, seasonID: 33 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 33 },
  { bowlerID: 386, bowlerName: 'Kristie Porter', isActive: true, seasonID: 33 },
  { bowlerID: 435, bowlerName: 'Martin Hall', isActive: true, seasonID: 33 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 33 },
  // Season 34 - Fall 2025
  { bowlerID: 121, bowlerName: 'Christina Manzella', isActive: true, seasonID: 34 },
  { bowlerID: 225, bowlerName: 'Geoffrey Berry', isActive: true, seasonID: 34 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 34 },
  { bowlerID: 386, bowlerName: 'Kristie Porter', isActive: true, seasonID: 34 },
  { bowlerID: 435, bowlerName: 'Martin Hall', isActive: true, seasonID: 34 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 34 },
  // Season 35 - Spring 2026
  { bowlerID: 59, bowlerName: 'Bill Jenniches', isActive: true, seasonID: 35 },
  { bowlerID: 121, bowlerName: 'Christina Manzella', isActive: true, seasonID: 35 },
  { bowlerID: 225, bowlerName: 'Geoffrey Berry', isActive: true, seasonID: 35 },
  { bowlerID: 326, bowlerName: 'John Williams', isActive: true, seasonID: 35 },
  { bowlerID: 386, bowlerName: 'Kristie Porter', isActive: true, seasonID: 35 },
  { bowlerID: 398, bowlerName: 'Lauren McCullough', isActive: true, seasonID: 35 },
  { bowlerID: 435, bowlerName: 'Martin Hall', isActive: true, seasonID: 35 },
  { bowlerID: 548, bowlerName: 'Russ Dean', isActive: true, seasonID: 35 },
];

const SEASONS = [
  { seasonID: 1,  label: "S'07", full: 'Spring 2007' },
  { seasonID: 2,  label: "F'08", full: 'Fall 2008' },
  { seasonID: 3,  label: "S'09", full: 'Spring 2009' },
  { seasonID: 4,  label: "F'09", full: 'Fall 2009' },
  { seasonID: 5,  label: "S'10", full: 'Spring 2010' },
  { seasonID: 6,  label: "F'10", full: 'Fall 2010' },
  { seasonID: 7,  label: "S'11", full: 'Spring 2011' },
  { seasonID: 8,  label: "F'11", full: 'Fall 2011' },
  { seasonID: 9,  label: "S'12", full: 'Spring 2012' },
  { seasonID: 10, label: "F'12", full: 'Fall 2012' },
  { seasonID: 11, label: "S'13", full: 'Spring 2013' },
  { seasonID: 12, label: "F'13", full: 'Fall 2013' },
  { seasonID: 13, label: "S'14", full: 'Spring 2014' },
  { seasonID: 14, label: "F'14", full: 'Fall 2014' },
  { seasonID: 15, label: "S'15", full: 'Spring 2015' },
  { seasonID: 16, label: "F'15", full: 'Fall 2015' },
  { seasonID: 17, label: "S'16", full: 'Spring 2016' },
  { seasonID: 18, label: "F'16", full: 'Fall 2016' },
  { seasonID: 19, label: "S'17", full: 'Spring 2017' },
  { seasonID: 20, label: "F'17", full: 'Fall 2017' },
  { seasonID: 21, label: "S'18", full: 'Spring 2018' },
  { seasonID: 22, label: "F'18", full: 'Fall 2018' },
  { seasonID: 23, label: "S'19", full: 'Spring 2019' },
  { seasonID: 24, label: "F'19", full: 'Fall 2019' },
  { seasonID: 25, label: "S'20", full: 'Spring 2020' },
  { seasonID: 26, label: "F'21", full: 'Fall 2021' },
  { seasonID: 27, label: "S'22", full: 'Spring 2022' },
  { seasonID: 28, label: "F'22", full: 'Fall 2022' },
  { seasonID: 29, label: "S'23", full: 'Spring 2023' },
  { seasonID: 30, label: "F'23", full: 'Fall 2023' },
  { seasonID: 31, label: "S'24", full: 'Spring 2024' },
  { seasonID: 32, label: "F'24", full: 'Fall 2024' },
  { seasonID: 33, label: "S'25", full: 'Spring 2025' },
  { seasonID: 34, label: "F'25", full: 'Fall 2025' },
  { seasonID: 35, label: "S'26", full: 'Spring 2026' },
];

type BowlerRow = {
  bowlerID: number;
  bowlerName: string;
  isActive: boolean;
  seasons: Set<number>;
  firstSeason: number;
  totalSeasons: number;
};

function buildBowlerRows(): BowlerRow[] {
  const map = new Map<number, BowlerRow>();
  for (const e of ROSTER) {
    if (!map.has(e.bowlerID)) {
      map.set(e.bowlerID, {
        bowlerID: e.bowlerID,
        bowlerName: e.bowlerName,
        isActive: e.isActive,
        seasons: new Set(),
        firstSeason: e.seasonID,
        totalSeasons: 0,
      });
    }
    const row = map.get(e.bowlerID)!;
    row.seasons.add(e.seasonID);
    if (e.seasonID < row.firstSeason) row.firstSeason = e.seasonID;
  }
  const rows = Array.from(map.values());
  rows.forEach(r => { r.totalSeasons = r.seasons.size; });
  rows.sort((a, b) => a.firstSeason - b.firstSeason || a.bowlerName.localeCompare(b.bowlerName));
  return rows;
}

const BOWLER_ROWS = buildBowlerRows();
const TOTAL_UNIQUE = BOWLER_ROWS.length;

type HoveredCell = {
  bowlerName: string;
  seasonFull: string;
  totalSeasons: number;
  isActive: boolean;
};

function cellColor(bowlerID: number, isActive: boolean): string {
  if (bowlerID === 548) return '#dc2626'; // Russ: red
  if (isActive) return '#1e3a5f';          // active: navy
  return '#94a3b8';                         // inactive: slate
}

const COVID_AFTER = 25; // extra gap after this seasonID to mark the pause

export default function LuckyStrikesPage() {
  const [hovered, setHovered] = useState<HoveredCell | null>(null);

  const CELL = 22;
  const GAP = 2;
  const COVID_GAP = 12;
  const NAME_W = 170;

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-[#1e3a5f] text-white px-6 py-8">
        <h1 className="font-heading text-3xl sm:text-4xl mb-1">Lucky Strikes</h1>
        <p className="text-white/70 text-sm">Roster history: all 35 seasons (2007&ndash;2026)</p>
        <div className="flex flex-wrap gap-6 mt-4 text-sm">
          <Stat value="35" label="seasons" />
          <Stat value={String(TOTAL_UNIQUE)} label="unique bowlers" />
          <Stat value="2007" label="founded" />
        </div>
      </div>

      {/* Legend + hover info */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-sm inline-block" style={{ background: '#dc2626' }} />
          <span className="text-slate-600">Russ Dean (all 35)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-sm inline-block" style={{ background: '#1e3a5f' }} />
          <span className="text-slate-600">Currently active</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-sm inline-block" style={{ background: '#94a3b8' }} />
          <span className="text-slate-600">Alumni</span>
        </div>
        {hovered ? (
          <div className="ml-auto text-slate-700 font-medium">
            {hovered.bowlerName} &middot; {hovered.seasonFull} &middot; {hovered.totalSeasons} season{hovered.totalSeasons !== 1 ? 's' : ''} total
            {hovered.isActive ? ' (active)' : ' (alumni)'}
          </div>
        ) : (
          <div className="ml-auto text-slate-400 italic">hover a cell to explore</div>
        )}
      </div>

      {/* Grid */}
      <div className="px-6 py-6 overflow-x-auto">
        <div style={{ minWidth: NAME_W + SEASONS.length * (CELL + GAP) + COVID_GAP }}>

          {/* Season header row */}
          <div className="flex items-end mb-2" style={{ paddingLeft: NAME_W, height: 52 }}>
            {SEASONS.map(s => (
              <div
                key={s.seasonID}
                style={{
                  width: CELL,
                  marginRight: s.seasonID === COVID_AFTER ? COVID_GAP + GAP : GAP,
                  flexShrink: 0,
                  position: 'relative',
                }}
                className="flex justify-center"
              >
                <span
                  style={{
                    fontSize: 9,
                    color: '#94a3b8',
                    writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)',
                    whiteSpace: 'nowrap',
                    lineHeight: 1,
                  }}
                >
                  {s.label}
                </span>
                {s.seasonID === COVID_AFTER && (
                  <span
                    style={{
                      position: 'absolute',
                      right: -(COVID_GAP + GAP) / 2 - 6,
                      bottom: 0,
                      fontSize: 8,
                      color: '#cbd5e1',
                      writingMode: 'vertical-rl',
                      transform: 'rotate(180deg)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    COVID
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Bowler rows */}
          {BOWLER_ROWS.map(bowler => (
            <div key={bowler.bowlerID} className="flex items-center mb-[2px]">
              {/* Name */}
              <div
                style={{ width: NAME_W, flexShrink: 0, paddingRight: 12, textAlign: 'right', fontSize: 11, color: '#475569', lineHeight: 1 }}
              >
                {bowler.bowlerName}
                <span style={{ color: '#94a3b8', marginLeft: 4 }}>({bowler.totalSeasons})</span>
              </div>

              {/* Season cells */}
              {SEASONS.map(s => {
                const present = bowler.seasons.has(s.seasonID);
                return (
                  <div
                    key={s.seasonID}
                    style={{
                      width: CELL,
                      height: CELL,
                      marginRight: s.seasonID === COVID_AFTER ? COVID_GAP + GAP : GAP,
                      flexShrink: 0,
                      borderRadius: 3,
                      backgroundColor: present
                        ? cellColor(bowler.bowlerID, bowler.isActive)
                        : '#f1f5f9',
                      cursor: present ? 'pointer' : 'default',
                      transition: 'opacity 0.1s',
                    }}
                    onMouseEnter={() => present && setHovered({
                      bowlerName: bowler.bowlerName,
                      seasonFull: s.full,
                      totalSeasons: bowler.totalSeasons,
                      isActive: bowler.isActive,
                    })}
                    onMouseLeave={() => setHovered(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer note */}
      <div className="px-6 pb-8 text-xs text-slate-400">
        Gap between S&apos;20 and F&apos;21 reflects the COVID pause.
        Season IDs are sequential, not calendar-year labels.
      </div>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-white/60 ml-1">{label}</span>
    </div>
  );
}
