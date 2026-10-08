# Vocabulary ids for research agents

Generated from data/vocab by research/tools/make_cheatsheet.py. Use these ids exactly.

## kind
nonprofit, civic, club, team, student_org, congregation, friends_group, garden, program, network, support_group

## categories (family id) and interests (tag ids under it)

- **outdoors-adventure**: hiking, caving, climbing, kayaking, birding, camping
- **nature-environment**: trail_building, park_cleanup, friends_of_park, tree_tending, river_stewardship, habitat_restoration, citizen_science, climate_action
- **gardening-greening**: community_garden, urban_farming, vacant_lot_greening, community_orchard, pollinators_bees, garden_club
- **sports-teams**: soccer, basketball, softball_baseball, kickball_rec_leagues, football_rugby, tennis_pickleball, hockey_roller_derby, cricket, youth_coaching, adaptive_sports, sports_fans
- **running-cycling-fitness**: running, walking_group, group_bike_rides, bike_repair, yoga_movement, strength_training, martial_arts
- **water-rowing**: rowing, youth_rowing, dragon_boat, sailing, swimming, regatta_volunteering
- **arts-crafts**: painting_drawing, pottery_ceramics, fiber_arts, mural_public_art, photography, film_video, printmaking, craft_circle
- **music**: choir_singing, community_band, jam_sessions, drum_circle, instrument_lessons, dj_hip_hop, folk_traditional_music
- **theater-dance-performance**: community_theater, improv_comedy, social_dance, dance_company, cultural_dance, stage_crew, storytelling_spoken_word, variety_cabaret
- **books-writing**: book_club, writing_group, poetry, zines_media, literacy_tutoring, prison_book_programs, library_programs
- **games-puzzles**: board_games, chess, tabletop_rpg, trivia_nights, puzzles_escape, video_games, fandom_cons
- **making-tech**: woodworking, makerspace, electronics_robotics, coding_software, repair_cafe, cars_motorcycles, ham_radio, digital_skills
- **science-learning**: astronomy, geology_fossils, natural_history, talks_lectures, philosophy_discussion, stem_outreach, adult_learning
- **history-heritage-preservation**: historic_site_volunteering, walking_tours, genealogy, oral_history, preservation_architecture, cemetery_friends, museum_volunteering
- **culture-language-heritage-groups**: language_exchange, esl_conversation, heritage_clubs, heritage_schools, immigrant_welcome, sign_language, cultural_exchange
- **food-drink**: cooking_baking, community_meals, homebrew_wine, farmers_markets_coops, foodie_meetups, heritage_cooking
- **animals**: shelter_volunteering, cat_rescue_tnr, animal_fostering, wildlife_rehab, dog_owner_groups, horses_riding, pet_birds_hobbies, zoo_volunteering
- **neighborhood-civic**: civic_association, town_watch, block_captain, clean_blocks, rec_center_council, police_advisory, community_development, voter_education
- **advocacy-rights**: tenant_rights, street_safety_transit, immigrant_rights, disability_rights, racial_equity, womens_lgbtq_rights, worker_rights, justice_reform_reentry, violence_prevention, civil_liberties_privacy
- **hunger-housing-basic-needs**: food_pantry, community_fridge, mutual_aid, food_rescue, housing_help, homeless_outreach, goods_closets, home_repair, free_help_clinics
- **kids-youth-mentoring**: mentoring, tutoring, after_school_camps, scouts_youth_clubs, youth_leadership, school_parent_groups, parent_playgroups, foster_care_support
- **seniors-intergenerational**: senior_centers, friendly_visiting, intergenerational, retiree_corps, senior_activities, nursing_home_hospice, neighbor_errands
- **health-wellness**: meditation_mindfulness, tai_chi_qigong, health_outreach, hospital_volunteering, mental_health_awareness, harm_reduction, doula_birth_support
- **faith-community**: worship_community, faith_service_projects, interfaith, scripture_study, worship_music, faith_youth_programs, humanist_spiritual, congregation_social
- **social-meetups**: newcomer_meetups, conversation_circles, young_adult_social, singles_dating, lgbtq_social, affinity_social, neurodivergent_social, sober_social, veterans_posts, fraternal_service_clubs
- **careers-skills-professional**: job_clubs, public_speaking, professional_associations, board_service, skills_volunteering, entrepreneurs, trades_training, money_skills
- **emergency-disaster**: emergency_response_teams, disaster_relief, first_aid_cpr, volunteer_fire_ems, preparedness_planning, weather_checks, search_rescue
- **philly-traditions**: mummers_string_band, mummers_fancy_brigade, mummers_comic_club, mummers_clubhouse, parade_units, street_festivals
- **support-recovery** (support groups only): grief_support, addiction_recovery, caregiver_support, mental_health_support, chronic_illness_support, parenting_support, lgbtq_support, survivor_support

## motives
values, understanding, social, career, protective, enhancement

## formats
side_by_side, conversation, team_play, perform_make_together, behind_the_scenes, lead_organize, learn_skill, one_off_event

## roles
hands_on, figure_out, create, help_teach, lead, organize

## audiences: crowd
all_ages, all_adults, families, kids, teens, young_adults, seniors, students, professionals, neighbors, newcomers

## audiences: open_to
public, students, members, parents, residents, invite

## audiences: community
lgbtq, transgender, women, men, black, latino, asian_american, native_american, pacific_islander, immigrants, refugees, veterans, parents, disability, deaf, blind, neurodivergent, sober, returning_citizens

## audiences: heritage
irish, italian, polish, ukrainian, russian, lithuanian, german, greek, albanian, portuguese, jewish, black_american, west_african, liberian, nigerian, ethiopian, eritrean, somali, caribbean, jamaican, haitian, puerto_rican, dominican, mexican, cuban, colombian, central_american, brazilian, chinese, vietnamese, cambodian, korean, japanese, filipino, indonesian, indian, pakistani, bangladeshi, nepali, bhutanese, burmese, arab, iranian, turkish

## audiences: faith
catholic, protestant, black_church, orthodox_christian, jewish, muslim, buddhist, hindu, sikh, quaker, unitarian, interfaith, other

In `audience.community` write heritage as `heritage:<id>` (e.g. `heritage:irish`) and languages as
`language:<code>` (e.g. `language:es`). In `access.languages` write the bare code (`en`, `es`, `zh`, `vi`).
