
'use client';

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { courses as initialCourses, type Course, type Chapter, type Topic } from '@/lib/courses-data';
import { nanoid } from 'nanoid';

const isServer = typeof window === 'undefined';

interface CoursesContextValue {
  courses: Course[];
  setCourses: (courses: Course[]) => void;
  addCourse: (title: string, description: string) => void;
  updateCourse: (courseId: string, updatedCourse: Partial<Course>) => void;
  deleteCourse: (courseId: string) => void;
  addChapter: (courseId: string, title: string, description: string) => void;
  updateChapter: (courseId: string, chapterId: string, updatedChapter: Partial<Chapter>) => void;
  deleteChapter: (courseId: string, chapterId: string) => void;
  updateTopic: (courseId: string, chapterId: string, topicId: string, updatedTopic: Topic) => void;
}

const CoursesContext = createContext<CoursesContextValue | undefined>(undefined);

export function CoursesProvider({ children }: { children: React.ReactNode }) {
  const [courses, setCourses] = useState<Course[]>(() => {
    if (isServer) {
      return initialCourses;
    }
    try {
      const item = window.localStorage.getItem('courses-data');
      return item ? JSON.parse(item) : initialCourses;
    } catch (error) {
      console.error(error);
      return initialCourses;
    }
  });
  
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isServer) {
        try {
            const item = window.localStorage.getItem('courses-data');
            if (item) {
                setCourses(JSON.parse(item));
            }
        } catch (error) {
            console.error("Failed to parse courses from localStorage", error);
        }
        setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!isServer && isInitialized) {
      try {
        window.localStorage.setItem('courses-data', JSON.stringify(courses));
      } catch (error) {
        console.error("Failed to save courses to localStorage", error);
      }
    }
  }, [courses, isInitialized]);

  const addCourse = useCallback((title: string, description: string) => {
    const newCourse: Course = {
      id: nanoid(),
      title,
      description,
      chapters: [],
    };
    setCourses(prev => [...prev, newCourse]);
  }, []);

  const updateCourse = useCallback((courseId: string, updatedCourseData: Partial<Course>) => {
    setCourses(prev => prev.map(course => 
      course.id === courseId ? { ...course, ...updatedCourseData } : course
    ));
  }, []);

  const deleteCourse = useCallback((courseId: string) => {
    setCourses(prev => prev.filter(course => course.id !== courseId));
  }, []);

  const addChapter = useCallback((courseId: string, title: string, description: string) => {
    const newChapter: Chapter = {
      id: nanoid(),
      title,
      description,
      topics: [],
    };
    setCourses(prev => prev.map(course => 
      course.id === courseId 
        ? { ...course, chapters: [...course.chapters, newChapter] }
        : course
    ));
  }, []);

  const updateChapter = useCallback((courseId: string, chapterId: string, updatedChapterData: Partial<Chapter>) => {
    setCourses(prev => prev.map(course => 
      course.id === courseId
        ? { 
            ...course, 
            chapters: course.chapters.map(chapter => 
              chapter.id === chapterId ? { ...chapter, ...updatedChapterData } : chapter
            )
          }
        : course
    ));
  }, []);

  const deleteChapter = useCallback((courseId: string, chapterId: string) => {
    setCourses(prev => prev.map(course => 
      course.id === courseId
        ? { ...course, chapters: course.chapters.filter(chap => chap.id !== chapterId) }
        : course
    ));
  }, []);

  const updateTopic = useCallback((courseId: string, chapterId: string, topicId: string, updatedTopic: Topic) => {
    setCourses(prev => prev.map(course => {
        if (course.id !== courseId) return course;
        return {
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
    }));
  }, []);


  const value = useMemo(() => ({
    courses,
    setCourses,
    addCourse,
    updateCourse,
    deleteCourse,
    addChapter,
    updateChapter,
    deleteChapter,
    updateTopic,
  }), [courses, addCourse, updateCourse, deleteCourse, addChapter, updateChapter, deleteChapter, updateTopic]);

  if (!isInitialized) {
      return null; // or a loading spinner
  }

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
