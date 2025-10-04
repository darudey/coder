
'use client';

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { courses as initialCoursesData, type Course, type Chapter, type Topic } from '@/lib/courses-data';
import { nanoid } from 'nanoid';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, writeBatch, setDoc, deleteDoc, runTransaction } from 'firebase/firestore';

const isServer = typeof window === 'undefined';

interface CoursesContextValue {
  courses: Course[];
  loading: boolean;
  addCourse: (title: string, description: string) => Promise<void>;
  updateCourse: (courseId: string, updatedCourse: Partial<Course>) => Promise<void>;
  deleteCourse: (courseId: string) => Promise<void>;
  reorderCourse: (courseId: string, direction: 'up' | 'down') => Promise<void>;
  addChapter: (courseId: string, title: string, description: string) => Promise<void>;
  updateChapter: (courseId: string, chapterId: string, updatedChapter: Partial<Chapter>) => Promise<void>;
  deleteChapter: (courseId: string, chapterId: string) => Promise<void>;
  reorderChapter: (courseId: string, chapterId: string, direction: 'up' | 'down') => Promise<void>;
  updateTopic: (courseId: string, chapterId: string, topicId: string, updatedTopic: Topic) => void;
}

const CoursesContext = createContext<CoursesContextValue | undefined>(undefined);

export function CoursesProvider({ children }: { children: React.ReactNode }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const writeCoursesToDb = async (coursesToSave: Course[]) => {
    const batch = writeBatch(db);
    coursesToSave.forEach((course, index) => {
      const courseRef = doc(db, 'courses', course.id);
      batch.set(courseRef, { ...course, order: index });
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
            setCourses(initialCoursesData.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
          } else {
            const coursesFromDb = querySnapshot.docs.map(doc => doc.data() as Course).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
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
      order: courses.length,
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
    const coursesToUpdate = originalCourses.filter(course => course.id !== courseId);
    
    // Re-order the remaining courses
    const reorderedCourses = coursesToUpdate.map((course, index) => ({...course, order: index}));
    setCourses(reorderedCourses);

    try {
      await runTransaction(db, async (transaction) => {
        // Delete the course
        const courseRef = doc(db, 'courses', courseId);
        transaction.delete(courseRef);
        // Update the order of the rest
        reorderedCourses.forEach(course => {
            const courseRefToUpdate = doc(db, 'courses', course.id);
            transaction.update(courseRefToUpdate, { order: course.order });
        });
      });
    } catch (e) {
      console.error("Failed to delete course: ", e);
      setCourses(originalCourses); // Revert
    }
  }, [courses]);

  const reorderCourse = useCallback(async (courseId: string, direction: 'up' | 'down') => {
      const reordered = Array.from(courses);
      const fromIndex = reordered.findIndex(c => c.id === courseId);
      if (fromIndex === -1) return;

      const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= reordered.length) return;

      // Swap items
      [reordered[fromIndex], reordered[toIndex]] = [reordered[toIndex], reordered[fromIndex]];
      
      // Update order property
      reordered[fromIndex].order = fromIndex;
      reordered[toIndex].order = toIndex;
      
      setCourses(reordered); // Optimistic update

      try {
        const batch = writeBatch(db);
        const ref1 = doc(db, 'courses', reordered[fromIndex].id);
        batch.update(ref1, { order: reordered[fromIndex].order });
        const ref2 = doc(db, 'courses', reordered[toIndex].id);
        batch.update(ref2, { order: reordered[toIndex].order });
        await batch.commit();
      } catch(e) {
          console.error("Failed to reorder courses", e);
          setCourses(courses); // Revert
      }

  }, [courses]);

  const addChapter = useCallback(async (courseId: string, title: string, description: string) => {
    const originalCourses = courses;
    const course = originalCourses.find(c => c.id === courseId);
    if (!course) return;
    
    const newTopicId = nanoid();
    const defaultTopic: Topic = {
        id: newTopicId,
        title: 'New Topic',
        videoUrl: '',
        notes: [
            { type: 'html', content: `<h4>Welcome to Your New Topic!</h4><p>This is where you can write notes for your students. You can use the toolbar to format your text.</p>`},
            { type: 'code', content: `console.log("Hello, Teacher!");`}
        ],
        syntax: `// Provide a clean syntax example here.`,
        practice: [{ id: nanoid(), question: 'What will this code output?', initialCode: `console.log("Hello, Student!");`, solutionCode: `console.log("Hello, Student!");`, expectedOutput: 'Hello, Student!'}]
    };

    const newChapter: Chapter = {
      id: nanoid(),
      title,
      description,
      topics: [defaultTopic],
      order: course.chapters.length
    };
    
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

    let updatedChapters = course.chapters.filter(chap => chap.id !== chapterId);
    // Re-order remaining chapters
    updatedChapters = updatedChapters.map((chap, index) => ({...chap, order: index}));

    const updatedCourse = {
        ...course,
        chapters: updatedChapters
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

  const reorderChapter = useCallback(async (courseId: string, chapterId: string, direction: 'up' | 'down') => {
      const originalCourses = courses;
      const course = originalCourses.find(c => c.id === courseId);
      if (!course) return;

      const reorderedChapters = Array.from(course.chapters);
      const fromIndex = reorderedChapters.findIndex(c => c.id === chapterId);
      if (fromIndex === -1) return;

      const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= reorderedChapters.length) return;

      // Swap items
      [reorderedChapters[fromIndex], reorderedChapters[toIndex]] = [reorderedChapters[toIndex], reorderedChapters[fromIndex]];
      
      // Update order property
      reorderedChapters[fromIndex].order = fromIndex;
      reorderedChapters[toIndex].order = toIndex;

      const updatedCourse = {...course, chapters: reorderedChapters};
      const updatedCourses = originalCourses.map(c => c.id === courseId ? updatedCourse : c);
      setCourses(updatedCourses); // Optimistic update

      try {
        await setDoc(doc(db, 'courses', courseId), updatedCourse);
      } catch(e) {
          console.error("Failed to reorder chapters", e);
          setCourses(originalCourses); // Revert
      }
  }, [courses]);


  const updateTopic = useCallback((courseId: string, chapterId: string, topicId: string, updatedTopic: Topic) => {
    setCourses(prevCourses => {
        const newCourses = prevCourses.map(course => {
            if (course.id !== courseId) return course;

            const newChapters = course.chapters.map(chapter => {
                if (chapter.id !== chapterId) return chapter;

                const newTopics = chapter.topics.map(topic => 
                    topic.id === topicId ? updatedTopic : topic
                );
                return { ...chapter, topics: newTopics };
            });
            return { ...course, chapters: newChapters };
        });
        return newCourses;
    });
  }, []);


  const value = useMemo(() => ({
    courses,
    loading,
    addCourse,
    updateCourse,
    deleteCourse,
    reorderCourse,
    addChapter,
    updateChapter,
    deleteChapter,
    reorderChapter,
    updateTopic,
  }), [courses, loading, addCourse, updateCourse, deleteCourse, reorderCourse, addChapter, updateChapter, deleteChapter, reorderChapter, updateTopic]);

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
