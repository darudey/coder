
'use client';

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { courses as initialCoursesData, type Course, type Chapter, type Topic } from '@/lib/courses-data';
import { nanoid } from 'nanoid';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, writeBatch, setDoc, deleteDoc } from 'firebase/firestore';

const isServer = typeof window === 'undefined';

interface CoursesContextValue {
  courses: Course[];
  loading: boolean;
  addCourse: (title: string, description: string) => Promise<void>;
  updateCourse: (courseId: string, updatedCourse: Partial<Course>) => Promise<void>;
  deleteCourse: (courseId: string) => Promise<void>;
  addChapter: (courseId: string, title: string, description: string) => Promise<void>;
  updateChapter: (courseId: string, chapterId: string, updatedChapter: Partial<Chapter>) => Promise<void>;
  deleteChapter: (courseId: string, chapterId: string) => Promise<void>;
  updateTopic: (courseId: string, chapterId: string, topicId: string, updatedTopic: Topic) => Promise<void>;
}

const CoursesContext = createContext<CoursesContextValue | undefined>(undefined);

export function CoursesProvider({ children }: { children: React.ReactNode }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const writeCoursesToDb = async (coursesToSave: Course[]) => {
    const batch = writeBatch(db);
    coursesToSave.forEach(course => {
      const courseRef = doc(db, 'courses', course.id);
      batch.set(courseRef, course);
    });
    await batch.commit();
  };

  useEffect(() => {
    const fetchCourses = async () => {
      if (!isServer) {
        setLoading(true);
        try {
          const querySnapshot = await getDocs(collection(db, "courses"));
          if (querySnapshot.empty) {
            // No courses in DB, let's upload the initial data
            await writeCoursesToDb(initialCoursesData);
            setCourses(initialCoursesData);
          } else {
            const coursesFromDb = querySnapshot.docs.map(doc => doc.data() as Course);
            setCourses(coursesFromDb);
          }
        } catch (error) {
          console.error("Failed to fetch or initialize courses from Firestore", error);
        }
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  const addCourse = useCallback(async (title: string, description: string) => {
    const newCourse: Course = {
      id: nanoid(),
      title,
      description,
      chapters: [],
    };
    const updatedCourses = [...courses, newCourse];
    setCourses(updatedCourses); // Optimistic update
    try {
      await setDoc(doc(db, 'courses', newCourse.id), newCourse);
    } catch (e) {
      console.error("Failed to add course: ", e);
      setCourses(courses); // Revert on failure
    }
  }, [courses]);

  const updateCourse = useCallback(async (courseId: string, updatedCourseData: Partial<Course>) => {
    const originalCourses = courses;
    const updatedCourses = courses.map(course =>
      course.id === courseId ? { ...course, ...updatedCourseData } : course
    );
    setCourses(updatedCourses); // Optimistic update
    
    const courseToUpdate = updatedCourses.find(c => c.id === courseId);
    if (courseToUpdate) {
      try {
        await setDoc(doc(db, 'courses', courseId), courseToUpdate, { merge: true });
      } catch (e) {
        console.error("Failed to update course: ", e);
        setCourses(originalCourses); // Revert
      }
    }
  }, [courses]);

  const deleteCourse = useCallback(async (courseId: string) => {
    const originalCourses = courses;
    const updatedCourses = courses.filter(course => course.id !== courseId);
    setCourses(updatedCourses); // Optimistic update
    try {
      await deleteDoc(doc(db, 'courses', courseId));
    } catch (e) {
      console.error("Failed to delete course: ", e);
      setCourses(originalCourses); // Revert
    }
  }, [courses]);

  const addChapter = useCallback(async (courseId: string, title: string, description: string) => {
    const defaultTopic: Topic = {
        id: nanoid(),
        title: 'New Topic',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        notes: [
            {
                type: 'html',
                content: `
                    <h4>Welcome to Your New Topic!</h4>
                    <p>This is where you can write notes for your students. You can use Markdown to format your text.</p>
                    <ul>
                        <li>Use lists to organize information.</li>
                        <li>Add <strong>bold</strong> or <em>italic</em> text.</li>
                        <li>Include links, images, and more.</li>
                    </ul>
                    <p>Below is a code block. You can add interactive code snippets to explain concepts.</p>
                `
            },
            {
                type: 'code',
                content: `console.log("Hello, Teacher!");\n// You can edit this code block.`
            }
        ],
        syntax: `// This is the syntax tab.\n// Use this area to provide a clean, read-only example of the core syntax for this topic.\n\nfunction example() {\n  return "This code demonstrates a concept.";\n}\n\nconsole.log(example());`,
        practice: [
            {
                id: nanoid(),
                question: 'This is a sample practice question. What will the following code output?',
                initialCode: `// Students will see this code and can run it.\nconst x = 10;\nconst y = 20;\nconsole.log(x + y);`,
                solutionCode: `// This is the solution code. Run it to generate the 'Expected Output'.\nconst x = 10;\nconst y = 20;\nconsole.log(x + y);`,
                expectedOutput: '30'
            }
        ]
    };

    const newChapter: Chapter = {
      id: nanoid(),
      title,
      description,
      topics: [defaultTopic],
    };
    
    const originalCourses = courses;
    const course = originalCourses.find(c => c.id === courseId);
    if (!course) return;
    
    const updatedCourse = { ...course, chapters: [...course.chapters, newChapter] };
    const updatedCourses = originalCourses.map(c => c.id === courseId ? updatedCourse : c);
    
    setCourses(updatedCourses); // Optimistic update

    try {
      await setDoc(doc(db, 'courses', courseId), updatedCourse);
    } catch(e) {
      console.error("Failed to add chapter: ", e);
      setCourses(originalCourses); // Revert
    }
  }, [courses]);

  const updateChapter = useCallback(async (courseId: string, chapterId: string, updatedChapterData: Partial<Chapter>) => {
    const originalCourses = courses;
    const course = originalCourses.find(c => c.id === courseId);
    if (!course) return;

    const updatedCourse = {
        ...course,
        chapters: course.chapters.map(chapter =>
            chapter.id === chapterId ? { ...chapter, ...updatedChapterData } : chapter
        )
    };
    const updatedCourses = originalCourses.map(c => c.id === courseId ? updatedCourse : c);
    setCourses(updatedCourses); // Optimistic update

    try {
        await setDoc(doc(db, 'courses', courseId), updatedCourse);
    } catch (e) {
        console.error("Failed to update chapter: ", e);
        setCourses(originalCourses); // Revert
    }
  }, [courses]);

  const deleteChapter = useCallback(async (courseId: string, chapterId: string) => {
     const originalCourses = courses;
    const course = originalCourses.find(c => c.id === courseId);
    if (!course) return;

    const updatedCourse = {
        ...course,
        chapters: course.chapters.filter(chap => chap.id !== chapterId)
    };
    const updatedCourses = originalCourses.map(c => c.id === courseId ? updatedCourse : c);
    setCourses(updatedCourses); // Optimistic update

    try {
        await setDoc(doc(db, 'courses', courseId), updatedCourse);
    } catch (e) {
        console.error("Failed to delete chapter: ", e);
        setCourses(originalCourses); // Revert
    }
  }, [courses]);

  const updateTopic = useCallback(async (courseId: string, chapterId: string, topicId: string, updatedTopic: Topic) => {
    const originalCourses = courses;
    const course = originalCourses.find(c => c.id === courseId);
    if (!course) return;

    const updatedCourse = {
        ...course,
        chapters: course.chapters.map(chapter => {
            if (chapter.id !== chapterId) return chapter;
            return {
                ...chapter,
                topics: chapter.topics.map(topic =>
                    topic.id === topicId ? updatedTopic : topic
                )
            };
        })
    };
    const updatedCourses = originalCourses.map(c => c.id === courseId ? updatedCourse : c);
    setCourses(updatedCourses); // Optimistic update

    try {
        await setDoc(doc(db, 'courses', courseId), updatedCourse);
    } catch (e) {
        console.error("Failed to update topic: ", e);
        setCourses(originalCourses); // Revert
    }
  }, [courses]);


  const value = useMemo(() => ({
    courses,
    loading,
    addCourse,
    updateCourse,
    deleteCourse,
    addChapter,
    updateChapter,
    deleteChapter,
    updateTopic,
  }), [courses, loading, addCourse, updateCourse, deleteCourse, addChapter, updateChapter, deleteChapter, updateTopic]);

  return (
    <CoursesContext.Provider value={value}>
      {children}
    </CoursesContext.Provider>
  );
}

export function useCourses() {
  const context = useContext(CoursesContext);
  if (context === undefined) {
    throw new Error('useCourses must be used within a CoursesProvider');
  }
  return context;
}
