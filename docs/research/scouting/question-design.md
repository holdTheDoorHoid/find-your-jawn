# Evidence check: quiz question design

Scouting report verifying the citations behind the proposed quiz redesign (best worst scaling,
elimination by aspects, an adaptive taste test round, reflective summaries, and related moves). Each
claim below was checked against Crossref, Semantic Scholar, and publisher pages. "Verdict" says
whether the citation exists and backs the stated use; "strength" is how solid the underlying evidence
is, independent of whether it was cited correctly.

## Claims table

| # | Claim | Verdict | Strength | Note |
|---|---|---|---|---|
| 1 | Ouellette and Wood (1998) on past behavior versus intention | partly supported | strong (as cited); use is an extrapolation | Confirmed: "Habit and intention in everyday life: The multiple processes by which past behavior predicts future behavior," Psychological Bulletin 124(1), 54 to 74, doi:10.1037/0033-2909.124.1.54. This is a meta analysis across many domains. Its real finding is narrower than "past beats intention everywhere": past behavior predicts future behavior directly, beyond stated intention, mainly when the behavior is frequent and the context is stable (habit). For effortful, infrequent behavior, intention still does most of the predicting. The design's planned use, asking people to recall one vivid concrete moment instead of rating their own interest abstractly, is a reasonable move but it is an episodic recall technique, not the habit frequency effect this paper actually tested. Cite it for "ask what people do, not what they say they're like," not for "one vivid memory beats a trait question," which needs its own support (see row 7). |
| 2 | Schwarz (1999) and Krosnick (1991) on question wording and satisficing | supported | strong, foundational | Schwarz: "Self reports: How the questions shape the answers," American Psychologist 54(2), 93 to 105, doi:10.1037/0003-066x.54.2.93. Krosnick: "Response strategies for coping with the cognitive demands of attitude measures in surveys," Applied Cognitive Psychology 5(3), 213 to 236, doi:10.1002/acp.2350050305 (over 2,500 citations). Both are reviews/theory papers rather than single studies with one effect size, which is appropriate for the role they play here: they establish the mechanisms (wording, order, response format shape answers; low motivation and task difficulty produce satisficing such as straightlining, non-differentiation, and acquiescence), which is exactly what motivates forced choice over rating scales. |
| 3 | Paulhus (1984) on social desirability inflating virtue ratings | partly supported | moderate | Confirmed: "Two component models of socially desirable responding," Journal of Personality and Social Psychology 46(3), 598 to 609, doi:10.1037/0022-3514.46.3.598. This paper validates a scale (self deceptive enhancement versus impression management); it is not itself a demonstration that people inflate their stated volunteering or community motives. It supports the general mechanism well, which is enough to justify forced choice or best worst scaling over rating scales for motive questions, but do not cite it as direct evidence about motive ratings specifically. |
| 4 | Best worst scaling / MaxDiff: Finn and Louviere (1992); Louviere, Flynn and Marley (2015) | partly supported | moderate for discrimination claim; unverified for "works on phones" | Finn and Louviere confirmed: "Determining the Appropriate Response to Evidence of Public Concern: The Case of Food Safety," Journal of Public Policy & Marketing 11(2), 12 to 25, doi:10.1177/074391569201100202. This is the method's origin paper (applied to food safety concern), not itself a head to head test against rating scales. Louviere, Flynn and Marley confirmed as a real book: "Best Worst Scaling," Cambridge University Press, 2015, doi:10.1017/cbo9781107337855. For the actual "discriminates better than ratings" claim, a stronger direct citation exists: Lee, Soutar and Louviere (2008), "The Best Worst Scaling Approach: An Alternative to Schwartz's Values Survey," Journal of Personality Assessment 90(4), 335 to 347, doi:10.1080/00223890802107925, which found best worst scaling produced sharper discrimination among values than Schwartz's rating scale survey, with less ceiling effect. Add this citation. No peer reviewed source was found this session for the specific "works well on phones" sub claim; treat that as a reasonable design assumption to pilot test, not a cited finding. |
| 5 | Elimination by aspects: Tversky (1972) | supported | strong, foundational | Confirmed: "Elimination by aspects: A theory of choice," Psychological Review 79(4), 281 to 299, doi:10.1037/h0032955. This is close to a direct match for the design use: EBA is literally a model of people screening options out with sequential hard cutoffs (an "aspect" that fails eliminates the option), which maps cleanly onto using deal breakers as hard filters separate from nice to haves. |
| 6 | Preferences constructed during elicitation: Lichtenstein and Slovic (2006) | supported | strong for the general principle; the specific application is an extrapolation | Confirmed as a real book: "The Construction of Preference," Cambridge University Press, 2006, doi:10.1017/cbo9780511618031 (an edited volume of papers on preference reversals and related constructive preference phenomena, not solely authored by Lichtenstein and Slovic, who edited it and wrote the overview chapter). Strongly supports the general claim that preferences are built at the moment of choice rather than simply read out from a stable internal ranking. Showing real group cards and watching reactions, instead of asking abstract preference questions, is a sound design response to this literature, though it is not a specific intervention tested in this volume; it is better supported directly by row 8's recommender systems citations. |
| 7 | Recognition beats recall; pictures beat lists from memory | supported (citation supplied here) | strong, converging evidence | No citation was supplied for this one; it asked us to find one. Three solid, independent sources converge: Standing (1973), "Learning 10,000 pictures," Quarterly Journal of Experimental Psychology 25(2), 207 to 222, doi:10.1080/14640747308400340 (near perfect recognition memory for thousands of photos); Mandler (1980), "Recognizing: The judgment of previous occurrence," Psychological Review 87(3), 252 to 271, doi:10.1037/0033-295x.87.3.252 (recognition needs only a familiarity judgment, recall needs active generation, a real cognitive difference); Goldstein and Gigerenzer (2002), "Models of ecological rationality: The recognition heuristic," Psychological Review 109(1), 75 to 90, doi:10.1037/0033-295x.109.1.75. Together these directly support choosing from pictured real groups over listing interests from memory. |
| 8 | Active learning, cold start, and critiquing in recommenders: Rashid et al. (2002); Elahi, Ricci and Rubens (2016); Chen and Pu (2012) | supported | strong | All three confirmed exactly as cited. Rashid et al., "Getting to know you: learning new user preferences in recommender systems," Proceedings of IUI 2002, 127 to 134, doi:10.1145/502716.502737. Elahi, Ricci and Rubens, "A survey of active learning in collaborative filtering recommender systems," Computer Science Review 20, 29 to 50, doi:10.1016/j.cosrev.2016.05.002 (title matches exactly). Chen and Pu, "Critiquing based recommenders: survey and emerging trends," User Modeling and User Adapted Interaction 22(1 to 2), 125 to 150, doi:10.1007/s11257-011-9108-6 (print issue dated 2012, matching the citation). This literature is a strong, direct match for an adaptive taste test with one tap "why not" critiques and expected information gain stopping rules; this is exactly the research tradition that technique comes from. |
| 9 | Questionnaire length and progress indicators: Galesic and Bosnjak (2009); Villar, Callegaro and Yang (2013) | supported | strong | Galesic and Bosnjak confirmed: "Effects of Questionnaire Length on Participation and Indicators of Response Quality in a Web Survey," Public Opinion Quarterly 73(2), 349 to 360 (page range in the citation list above was abbreviated; full range is 349 to 360), doi:10.1093/poq/nfp031. They found that a longer *stated* length reduced who even started or finished, and separately that response quality degraded the later a question sat in the survey (faster answers, more skipped items, shorter open text, flatter grid answers) independent of total length. Villar, Callegaro and Yang confirmed and read in full text: "Where Am I? A Meta Analysis of Experiments on the Effects of Progress Indicators for Web Surveys," Social Science Computer Review 31(6), 744 to 762, doi:10.1177/0894439313497468. Direct quote from the paper: "Fast to slow indicators reduced drop offs, whereas slow to fast indicators increased drop offs," while a constant speed indicator "does not significantly help reduce drop offs" (based on 7 experiments each for the fast to slow and slow to fast conditions, 18 for constant, so a moderate sized evidence base, not huge). This directly answers the question asked: yes, fast to slow pacing helps; a plain constant bar does not. |
| 10 | TIPI brief personality measure: Gosling, Rentfrow and Swann (2003) | partly supported, with a correction | moderate | Confirmed: "A very brief measure of the Big Five personality domains," Journal of Research in Personality 37(6), 504 to 528, doi:10.1016/s0092-6566(03)00046-1. Correction: the TIPI measures all five Big Five domains at two items each, not only openness and extraversion; describing it as if only those two traits get two item treatment is inaccurate. The reliability caveat is real but is most often raised about the Openness scale specifically (weakest convergent and discriminant validity of the five in published comparisons against longer Big Five measures), not Extraversion, which is typically TIPI's most reliable scale. Fine to use TIPI style brief items to calibrate stretch level and newcomer weighting; fix the description. |
| 11 | RIASEC vocational interests: Holland (1997); Nye, Su, Rounds and Drasgow (2012) | supported | strong for the backbone; a direct leisure/volunteering hit was also found | Holland confirmed as a real book: "Making Vocational Choices: A Theory of Vocational Personalities and Work Environments," 3rd edition, Psychological Assessment Resources, 1997, ISBN 0-911907-27-0. Nye, Su, Rounds and Drasgow confirmed, title matches exactly: "Vocational Interests and Performance: A Quantitative Summary of Over 60 Years of Research," Perspectives on Psychological Science 7(4), 384 to 403, doi:10.1177/1745691612449021. That meta analysis is about job performance and persistence; interest congruence tracks satisfaction and persistence more strongly than it tracks raw performance, which is the relevant piece for a leisure and volunteering matcher. On the specific ask, whether RIASEC has been used for leisure or volunteer matching: yes, found directly. Nagy, Trautwein and Lüdtke or similar aside, the clean hit is Hansen and Scullard, "Linking Leisure Interests to the RIASEC World of Work Map," Journal of Career Development 35(1), 5 to 22, doi:10.1177/0894845308317933 (2008), which maps leisure activity preferences onto the RIASEC hexagon directly. RIASEC is a sensible compact backbone for this product. |
| 12 | Possible selves: Markus and Nurius (1986) | supported | strong, foundational theory (not an effect size) | Confirmed: "Possible selves," American Psychologist 41(9), 954 to 969, doi:10.1037/0003-066x.41.9.954. This is a theoretical paper, not an experiment with an effect size, but it is the correct, standard citation for "a year from now, what would you love to say" as a device for self chosen stretch goals. |
| 13 | Confidentiality assurances and disclosure: Singer, Von Thurn and Miller (1995) | supported, minor title fix | moderate to strong | Confirmed, with a small title correction: the actual title is "Confidentiality Assurances and Response: A *Quantitative* Review of the Experimental Literature" (the word "Quantitative" is part of the real title), Public Opinion Quarterly 59(1), 66, doi:10.1086/269458. Good support for stating confidentiality plainly before sensitive items (support flow, record check avoidance, identity questions). |
| 14 | Labor illusion: Buell and Norton (2011) | supported | strong, multiple experiments | Confirmed: "The Labor Illusion: How Operational Transparency Increases Perceived Value," Management Science 57(9), 1564 to 1579, doi:10.1287/mnsc.1110.1376. Full text was behind a paywall this session (secondary sources and the public abstract were used instead of the PDF), but the finding is well established and widely cited: making matching work visibly effortful (search animations, visible computation, even added short delays) raised perceived value and preference across several lab and field experiments, sometimes making people prefer a slower, visibly working result to an instant one. Supports showing the matching work on the results screen. |
| 15 | Barnum / Forer effect: Forer (1949) | supported | strong, one of the most replicated findings in psychology | Confirmed: "The fallacy of personal validation: a classroom demonstration of gullibility," The Journal of Abnormal and Social Psychology 44(1), 118 to 123, doi:10.1037/h0059240 (note the exact original journal name, predecessor to today's Journal of Abnormal Psychology). Original demonstration: 39 students rated a generic, Barnum style personality sketch as a good fit for themselves personally, average rating 4.26 out of 5. Good support for avoiding vague type labels in favor of concrete group names and concrete reasons. |
| 16 | Reflective summaries, motivational interviewing: Miller and Rollnick, 3rd edition (2013) | supported | strong as a clinical technique base; the chip UI is a design extrapolation | Confirmed as a real book: "Motivational Interviewing: Helping People Change," 3rd edition, William R. Miller and Stephen Rollnick, Guilford Press, ISBN 978 1 60918 227 4. Reflective listening and summarizing back what was heard is a well established, well evidenced core MI technique. An editable "here's what we heard" chip screen before results is a sound, faithful translation of that technique into a web UI, though the book itself does not test a chip interface specifically. |
| 17 | Friendship takes time, the liking gap, and undervaluing strangers: Hall (2019); Boothby, Cooney, Sandstrom and Clark (2018); Epley and Schroeder (2014) | partly supported; flag the "go three times" copy specifically | strong citations; one overstated application | All three confirmed. Hall: "How many hours does it take to make a friend?," Journal of Social and Personal Relationships 36(4), 1278 to 1296, doi:10.1177/0265407518761225. Boothby, Cooney, Sandstrom and Clark: "The Liking Gap in Conversations: Do People Like Us More Than We Think?," Psychological Science 29(11), 1742 to 1756, doi:10.1177/0956797618783714; abstract confirms the gap was found with strangers in the lab, first year dorm mates, and workshop participants, and persisted for several months. Epley and Schroeder: "Mistakenly seeking solitude," Journal of Experimental Psychology: General 143(5), 1980 to 1999, doi:10.1037/a0037323. These three strongly support reassurance copy about a first conversation feeling better than expected. The "go three times" nudge is a weaker fit: Hall's actual headline numbers are on the order of 40 to 60 cumulative hours of contact to move from acquaintance to casual friend and well over 100 hours to close friend, not three visits. Three short visits rarely add up to that many hours. Keep the reassurance copy about talking to strangers; soften or re source the "three visits" framing (see row on mere exposure below). |

## What we missed

A few findings and risks that the draft did not name, each with a citation, that should feed into
the final design:

- **If a progress bar is used at all, make it fast to slow, not constant.** This is the single
  clearest actionable result found in this pass and the current draft just says "progress bar"
  with no pacing spec. Villar, Callegaro and Yang (2013), as above, found constant speed bars do
  not significantly reduce drop off, fast to slow bars do, and slow to fast bars make drop off
  worse. Related mechanism: Kivetz, Urminsky and Zheng (2006), "The Goal Gradient Hypothesis
  Resurrected: Purchase Acceleration, Illusionary Goal Progress, and Customer Retention," Journal
  of Marketing Research 43(1), 39 to 58, doi:10.1509/jmkr.43.1.39, on people speeding up as a goal
  appears closer, which is the likely mechanism behind why fast to slow pacing (progress visibly
  accelerating) helps.

- **Put true hard filter questions early, not late, regardless of total quiz length.** Galesic and
  Bosnjak (2009), as above, found response quality (speed, item nonresponse, open text length, grid
  variance) degrades the further a question sits into a survey, independent of overall length. The
  current 12 question order puts budget, access needs, and background check preference near the
  end (questions 8 and 12); those are exactly the fields the matching engine treats as hard filters,
  so they are the ones that most need a reliable answer.

- **Randomize option and card order inside any single screen.** Krosnick (1991) and the satisficing
  literature flag order effects and primacy as a symptom of low effort responding; this applies to
  the elimination by aspects filters, the best worst scaling motive question, and the taste test
  card round alike. The draft does not mention randomization and should.

- **Mere exposure is a better grounded reason to encourage repeat visits than a literal "three
  visits" count.** Zajonc (1968), "Attitudinal effects of mere exposure," Journal of Personality
  and Social Psychology Monograph Supplement 9(2, Pt. 2), 1 to 27, doi:10.1037/h0025848, shows
  liking rising with repeated exposure itself, not with a specific hour or visit threshold. Pair
  this with Hall (2019) for honest copy: say repeat visits help a place feel familiar (mere
  exposure, well supported, no specific number needed) rather than implying three visits produces
  a friendship (which Hall's own numbers do not support).

- **Confidentiality assurances should be targeted, not blanket.** Singer, Von Thurn and Miller
  (1995) is about sensitive items specifically (health, legal history, finances); applying a
  confidentiality assurance to every question risks the opposite effect documented in some of that
  literature, where assurances on non sensitive items can themselves raise suspicion. Reserve the
  assurance language for the record/background check question, the support flow, and the identity
  group question (question 11 in the current draft).

- **The post hoc barrier question has good support beyond what was cited.** For "what got in the
  way" after a missed intention, add: Gollwitzer and Brandstätter (1997), "Implementation
  intentions and effective goal pursuit," Journal of Personality and Social Psychology 73(1), 186 to
  199, doi:10.1037/0022-3514.73.1.186 (the original study that follows up on whether a planned
  project got done and why); and Sheeran and Webb (2016), "The Intention Behavior Gap," Social and
  Personality Psychology Compass 10(9), 503 to 518, doi:10.1111/spc3.12265, which names "failing to
  get started" and "getting derailed" as the two dominant failure modes, a useful frame for the
  multiple choice options on that screen (time, nerves, cost, never heard back).

- **Picture based elicitation changes answers, it does not just make them easier; test it.**
  Vriens, Loosschilder, Rosbergen and Wittink (1998), "Verbal versus Realistic Pictorial
  Representations in Conjoint Analysis with Design Attributes," Journal of Product Innovation
  Management 15(5), 455 to 467, doi:10.1111/1540-5885.1550455, found that photos versus text
  descriptions changed which attributes people weighted as important, and a 2024 split sample
  political conjoint study found images and text produced similar overall estimates but the image
  version was reported as harder to complete. Pictures for the taste test cards are well supported
  by recognition memory research (row 7), but pilot test for completion time and difficulty before
  committing, do not assume pictures are simply "better."

- **No solid peer reviewed number exists for "optimal" onboarding quiz length.** This was asked for
  directly and the search came up short. The closest things found were a recommender systems user
  study noting people tolerate a median of about 12 and up to 20 cold start questions, and the
  general survey literature on length and drop off (Galesic and Bosnjak, above). Treat 6 to 8 taste
  test cards plus the adaptive stop rule from row 8's active learning literature as an engineering
  choice to validate with this product's own data, not as a number backed by an outside study.

- **Icons help low literacy and non native readers only when concrete, and plain language is the
  better verified lever.** Bauer, Kunz and Gummer (2023), "Plain language in web questionnaires:
  effects on data quality and questionnaire evaluation," International Journal of Social Research
  Methodology 28(1), 57 to 69, doi:10.1080/13645579.2023.2294880, found plain wording measurably
  improved comprehension and response quality. Evidence specifically on icons was weaker and mixed
  in this pass: abstract or stylized icons can fail across literacy and cultural lines, while
  concrete, photorealistic icons test better, but this comes from secondary and grey literature
  sources this session could not fully verify as peer reviewed; mark the icon specific guidance as
  weak and user test it, while treating the plain language rule as solid.

- **The tap once, tap twice (like, love) gesture is worth a usability check against this same low
  literacy and accessibility goal.** It was not part of the claims list, but it follows directly
  from the point above: a double tap toggle whose meaning is not visible on screen is a nonstandard
  control, and the literature favors concrete, unambiguous, single action controls for this
  audience. This is a flag, not a verified finding; test it with real users rather than changing it
  on the strength of this note alone.

## References

Bauer, I., Kunz, T., & Gummer, T. (2023). Plain language in web questionnaires: effects on data quality and questionnaire evaluation. International Journal of Social Research Methodology, 28(1), 57 to 69. https://doi.org/10.1080/13645579.2023.2294880

Boothby, E. J., Cooney, G., Sandstrom, G. M., & Clark, M. S. (2018). The liking gap in conversations: Do people like us more than we think? Psychological Science, 29(11), 1742 to 1756. https://doi.org/10.1177/0956797618783714

Buell, R. W., & Norton, M. I. (2011). The labor illusion: How operational transparency increases perceived value. Management Science, 57(9), 1564 to 1579. https://doi.org/10.1287/mnsc.1110.1376

Chen, L., & Pu, P. (2012). Critiquing based recommenders: survey and emerging trends. User Modeling and User Adapted Interaction, 22(1 to 2), 125 to 150. https://doi.org/10.1007/s11257-011-9108-6

Elahi, M., Ricci, F., & Rubens, N. (2016). A survey of active learning in collaborative filtering recommender systems. Computer Science Review, 20, 29 to 50. https://doi.org/10.1016/j.cosrev.2016.05.002

Finn, A., & Louviere, J. J. (1992). Determining the appropriate response to evidence of public concern: The case of food safety. Journal of Public Policy & Marketing, 11(2), 12 to 25. https://doi.org/10.1177/074391569201100202

Forer, B. R. (1949). The fallacy of personal validation: a classroom demonstration of gullibility. The Journal of Abnormal and Social Psychology, 44(1), 118 to 123. https://doi.org/10.1037/h0059240

Galesic, M., & Bosnjak, M. (2009). Effects of questionnaire length on participation and indicators of response quality in a web survey. Public Opinion Quarterly, 73(2), 349 to 360. https://doi.org/10.1093/poq/nfp031

Goldstein, D. G., & Gigerenzer, G. (2002). Models of ecological rationality: The recognition heuristic. Psychological Review, 109(1), 75 to 90. https://doi.org/10.1037/0033-295x.109.1.75

Gollwitzer, P. M., & Brandstätter, V. (1997). Implementation intentions and effective goal pursuit. Journal of Personality and Social Psychology, 73(1), 186 to 199. https://doi.org/10.1037/0022-3514.73.1.186

Gosling, S. D., Rentfrow, P. J., & Swann, W. B., Jr. (2003). A very brief measure of the Big Five personality domains. Journal of Research in Personality, 37(6), 504 to 528. https://doi.org/10.1016/s0092-6566(03)00046-1

Hall, J. A. (2019). How many hours does it take to make a friend? Journal of Social and Personal Relationships, 36(4), 1278 to 1296. https://doi.org/10.1177/0265407518761225

Hansen, J. C., & Scullard, M. G. (2008). Linking leisure interests to the RIASEC world of work map. Journal of Career Development, 35(1), 5 to 22. https://doi.org/10.1177/0894845308317933

Holland, J. L. (1997). Making vocational choices: A theory of vocational personalities and work environments (3rd ed.). Psychological Assessment Resources. ISBN 0-911907-27-0.

Kivetz, R., Urminsky, O., & Zheng, Y. (2006). The goal gradient hypothesis resurrected: Purchase acceleration, illusionary goal progress, and customer retention. Journal of Marketing Research, 43(1), 39 to 58. https://doi.org/10.1509/jmkr.43.1.39

Krosnick, J. A. (1991). Response strategies for coping with the cognitive demands of attitude measures in surveys. Applied Cognitive Psychology, 5(3), 213 to 236. https://doi.org/10.1002/acp.2350050305

Lee, J. A., Soutar, G., & Louviere, J. (2008). The best worst scaling approach: An alternative to Schwartz's values survey. Journal of Personality Assessment, 90(4), 335 to 347. https://doi.org/10.1080/00223890802107925

Lichtenstein, S., & Slovic, P. (Eds.). (2006). The construction of preference. Cambridge University Press. https://doi.org/10.1017/cbo9780511618031

Louviere, J. J., Flynn, T. N., & Marley, A. A. J. (2015). Best worst scaling: Theory, methods and applications. Cambridge University Press. https://doi.org/10.1017/cbo9781107337855

Mandler, G. (1980). Recognizing: The judgment of previous occurrence. Psychological Review, 87(3), 252 to 271. https://doi.org/10.1037/0033-295x.87.3.252

Markus, H., & Nurius, P. (1986). Possible selves. American Psychologist, 41(9), 954 to 969. https://doi.org/10.1037/0003-066x.41.9.954

Miller, W. R., & Rollnick, S. (2013). Motivational interviewing: Helping people change (3rd ed.). Guilford Press. ISBN 978-1-60918-227-4.

Nye, C. D., Su, R., Rounds, J., & Drasgow, F. (2012). Vocational interests and performance: A quantitative summary of over 60 years of research. Perspectives on Psychological Science, 7(4), 384 to 403. https://doi.org/10.1177/1745691612449021

Ouellette, J. A., & Wood, W. (1998). Habit and intention in everyday life: The multiple processes by which past behavior predicts future behavior. Psychological Bulletin, 124(1), 54 to 74. https://doi.org/10.1037/0033-2909.124.1.54

Paulhus, D. L. (1984). Two component models of socially desirable responding. Journal of Personality and Social Psychology, 46(3), 598 to 609. https://doi.org/10.1037/0022-3514.46.3.598

Rashid, A. M., Albert, I., Cosley, D., Lam, S. K., McNee, S. M., Konstan, J. A., & Riedl, J. (2002). Getting to know you: learning new user preferences in recommender systems. Proceedings of the 7th International Conference on Intelligent User Interfaces (IUI 2002), 127 to 134. https://doi.org/10.1145/502716.502737

Schwarz, N. (1999). Self reports: How the questions shape the answers. American Psychologist, 54(2), 93 to 105. https://doi.org/10.1037/0003-066x.54.2.93

Sheeran, P., & Webb, T. L. (2016). The intention behavior gap. Social and Personality Psychology Compass, 10(9), 503 to 518. https://doi.org/10.1111/spc3.12265

Singer, E., Von Thurn, D. R., & Miller, E. R. (1995). Confidentiality assurances and response: A quantitative review of the experimental literature. Public Opinion Quarterly, 59(1), 66 to 77. https://doi.org/10.1086/269458

Standing, L. (1973). Learning 10,000 pictures. Quarterly Journal of Experimental Psychology, 25(2), 207 to 222. https://doi.org/10.1080/14640747308400340

Tversky, A. (1972). Elimination by aspects: A theory of choice. Psychological Review, 79(4), 281 to 299. https://doi.org/10.1037/h0032955

Villar, A., Callegaro, M., & Yang, Y. (2013). Where am I? A meta analysis of experiments on the effects of progress indicators for web surveys. Social Science Computer Review, 31(6), 744 to 762. https://doi.org/10.1177/0894439313497468

Vriens, M., Loosschilder, G. H., Rosbergen, E., & Wittink, D. R. (1998). Verbal versus realistic pictorial representations in conjoint analysis with design attributes. Journal of Product Innovation Management, 15(5), 455 to 467. https://doi.org/10.1111/1540-5885.1550455

Zajonc, R. B. (1968). Attitudinal effects of mere exposure. Journal of Personality and Social Psychology Monograph Supplement, 9(2, Pt. 2), 1 to 27. https://doi.org/10.1037/h0025848
