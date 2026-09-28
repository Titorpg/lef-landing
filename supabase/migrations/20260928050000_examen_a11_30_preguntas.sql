-- LEF — A1.1 corregido (28 sep 2026): se había copiado el form de 20 preguntas
-- ("VALIDATION EXAM LEVEL A1.1 - LUIS CABALLERO"); el bueno es "VALIDATION EXAM
-- MODULE 1 LEVEL A1.1" (30 preguntas, 100 puntos), el que el usuario ve en Classroom.

update public.validation_exams
   set title = 'VALIDATION EXAM MODULE 1 LEVEL A1.1',
       intro = 'This exam helps you check if you have reached the learning objectives of this course.
It does not affect your final result and does not determine if you move to the next level.
It is a tool to reflect on your progress and identify what you can improve.',
       content = $json${
 "version": 1,
 "sections": [
  {
   "title": "Grammar",
   "instructions": "Look at the questions and choose the correct answer.",
   "passage": null,
   "youtube": null,
   "items": [
    {
     "type": "choice",
     "id": "q1",
     "text": "1. I ____ a student",
     "options": [
      "am",
      "is",
      "are"
     ],
     "correct": [
      0
     ],
     "points": 3,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q2",
     "text": "2. She _____ from Mexico",
     "options": [
      "am",
      "is",
      "are"
     ],
     "correct": [
      1
     ],
     "points": 3,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q3",
     "text": "3. We _____ friends.",
     "options": [
      "am",
      "is",
      "are"
     ],
     "correct": [
      2
     ],
     "points": 3,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q4",
     "text": "4. He _____ from Spain. He is from Mexico",
     "options": [
      "isn't",
      "aren't",
      "am not"
     ],
     "correct": [
      0
     ],
     "points": 3,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q5",
     "text": "5. They _____ in the classroom right now.",
     "options": [
      "isn't",
      "aren't",
      "am not"
     ],
     "correct": [
      1
     ],
     "points": 3,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q6",
     "text": "6. \"_____ 20 years old.\" — Choose the correct contraction.",
     "options": [
      "I'm",
      "She's",
      "They're"
     ],
     "correct": [
      1
     ],
     "points": 3,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q7",
     "text": "7. _____ is my teacher. (referring to a woman)",
     "options": [
      "He",
      "She",
      "They"
     ],
     "correct": [
      1
     ],
     "points": 3,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q8",
     "text": "8. She is _____ engineer.",
     "options": [
      "a",
      "an",
      "the"
     ],
     "correct": [
      1
     ],
     "points": 3,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q9",
     "text": "9. He has _____ book and _____ umbrella.",
     "options": [
      "a / a",
      "an / an",
      "a / an"
     ],
     "correct": [
      2
     ],
     "points": 3,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q10",
     "text": "10. What is the plural of TOOTH?",
     "options": [
      "tooths",
      "teeth",
      "teeths"
     ],
     "correct": [
      1
     ],
     "points": 3,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q11",
     "text": "11. What is the plural of CHILD?",
     "options": [
      "childs",
      "children",
      "childes"
     ],
     "correct": [
      1
     ],
     "points": 3,
     "shuffle": true
    },
    {
     "type": "heading",
     "text": "Find the error in the sentence:"
    },
    {
     "type": "choice",
     "id": "q12",
     "text": "12. \"She are my classmate and he am from Brazil.\"",
     "options": [
      "are → is / am → is",
      "are → am / am → are",
      "There is no error"
     ],
     "correct": [
      0
     ],
     "points": 3,
     "shuffle": true
    }
   ]
  },
  {
   "title": "Vocabulary",
   "instructions": "Look at the questions and choose the best answer.",
   "passage": null,
   "youtube": null,
   "items": [
    {
     "type": "choice",
     "id": "q13",
     "text": "13. She is from the United States. She is ________",
     "options": [
      "American",
      "British",
      "Colombian"
     ],
     "correct": [
      0
     ],
     "points": 3,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q14",
     "text": "14. He is from Germany. He is _____.",
     "options": [
      "Spanish",
      "Italian",
      "German"
     ],
     "correct": [
      2
     ],
     "points": 3,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q15",
     "text": "15. How do you write the number 15 in English?",
     "options": [
      "fiveteen",
      "fifteen",
      "fiften"
     ],
     "correct": [
      1
     ],
     "points": 3,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q16",
     "text": "16. He talks a lot and is very social. He is _____.",
     "options": [
      "shy",
      "serious",
      "talkative"
     ],
     "correct": [
      2
     ],
     "points": 3,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q17",
     "text": "17. She never laughs and always looks calm and formal. She is _____.",
     "options": [
      "funny",
      "serious",
      "friendly"
     ],
     "correct": [
      0
     ],
     "points": 3,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q18",
     "text": "18. You use these to hear. They are your _____.",
     "options": [
      "eyes",
      "ears",
      "handa"
     ],
     "correct": [
      1
     ],
     "points": 3,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q19",
     "text": "19. Which of these is a free time activity?",
     "options": [
      "I am tall",
      "She is from Japan",
      "He likes to play sports"
     ],
     "correct": [
      2
     ],
     "points": 3,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q20",
     "text": "20. Choose the correct sentence about possessions.",
     "options": [
      "I don't like a drone",
      "I don't have a drone",
      "I am not a drone"
     ],
     "correct": [
      1
     ],
     "points": 3,
     "shuffle": true
    }
   ]
  },
  {
   "title": "Reading",
   "instructions": "Read and choose the best answer.",
   "passage": "About Carlos\nMy name is Carlos. I am 22 years old and I am from Barranquilla, Colombia. I am a student at an English academy. My teacher is Ms. Park. She is from South Korea and she is very smart and friendly. She isn't shy at all. In my class, there are two other students. The first is Sofia. She is from Spain and she is 19 years old. She is funny and talkative. She likes music and dancing. She has a guitar and a phone. She doesn't have a tablet. The second student is James. He is from the United Kingdom. He is British and he is 25 years old. He is tall and a little serious. He doesn't like loud noises, but he likes reading and watching movies. He has headphones and a tablet. He doesn't have a guitar. We are all different, but we are happy to learn English together.",
   "youtube": null,
   "items": [
    {
     "type": "choice",
     "id": "q21",
     "text": "21. Where is Carlos from?",
     "options": [
      "Spain",
      "South Korea",
      "Barranquilla"
     ],
     "correct": [
      2
     ],
     "points": 4,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q22",
     "text": "22. Which TWO adjectives describe Ms. Park?",
     "options": [
      "Shy and serious",
      "Smart and friendly",
      "Funny and talkative"
     ],
     "correct": [
      1
     ],
     "points": 4,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q23",
     "text": "23. Sofia and James are both students. What do they have in common?",
     "options": [
      "They are both from Europe",
      "They both have a guitar",
      "They both like loud noises"
     ],
     "correct": [
      0
     ],
     "points": 4,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q24",
     "text": "24. James is serious and doesn't like loud noises. What kind of free time activities probably suit him best?",
     "options": [
      "Dancing and cooking",
      "Reading and watching movies",
      "Playing sports and taking pictures"
     ],
     "correct": [
      1
     ],
     "points": 4,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q25",
     "text": "25. What does Sofia NOT have?",
     "options": [
      "A guitar",
      "A phone",
      "A tablet"
     ],
     "correct": [
      2
     ],
     "points": 4,
     "shuffle": true
    }
   ]
  },
  {
   "title": "Listening",
   "instructions": "Listen to the audio and choose the correct answer.",
   "passage": null,
   "youtube": "fsq11qZi4po",
   "items": [
    {
     "type": "choice",
     "id": "q26",
     "text": "26. What is his name?",
     "options": [
      "Luis",
      "Carlos",
      "Daniel"
     ],
     "correct": [
      1
     ],
     "points": 4,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q27",
     "text": "27. Where is he from?",
     "options": [
      "Colombia",
      "Mexico",
      "Brazil"
     ],
     "correct": [
      1
     ],
     "points": 4,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q28",
     "text": "28. How old is he?",
     "options": [
      "20",
      "25",
      "30"
     ],
     "correct": [
      1
     ],
     "points": 4,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q29",
     "text": "29. What does he like?",
     "options": [
      "Homework",
      "Music and video games",
      "Sports"
     ],
     "correct": [
      1
     ],
     "points": 4,
     "shuffle": true
    },
    {
     "type": "choice",
     "id": "q30",
     "text": "30. What does he NOT have?",
     "options": [
      "A phone",
      "Headphones",
      "A tablet"
     ],
     "correct": [
      2
     ],
     "points": 4,
     "shuffle": true
    }
   ]
  }
 ]
}$json$::jsonb,
       is_test = false,
       source_note = 'Google Form 1_RYgnrzdyZM-O5iknuu8tt_keShZabwbhVuiRtY9Vv4 (30 preguntas; copiado el 28 sep 2026)',
       updated_at = now()
 where module_level = 'A1.1';
