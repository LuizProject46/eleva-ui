import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GraduationCap, BarChart3 } from 'lucide-react';
import { CoursesAdmin } from '@/components/courses/CoursesAdmin';
import { CoursesEmployee } from '@/components/courses/CoursesEmployee';
import { CourseProgressGrid } from '@/components/courses/CourseProgressGrid';

export default function Courses() {
  const { isHR, isManager } = useAuth();

  if (isHR()) {
    return (
      <MainLayout>
        <Tabs defaultValue="courses" className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="courses" className="gap-2">
              <GraduationCap className="w-4 h-4" />
              Cursos
            </TabsTrigger>
            <TabsTrigger value="progress" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Progresso dos colaboradores
            </TabsTrigger>
          </TabsList>
          <TabsContent value="courses" className="mt-4">
            <CoursesAdmin />
          </TabsContent>
          <TabsContent value="progress" className="mt-4">
            <CourseProgressGrid />
          </TabsContent>
        </Tabs>
      </MainLayout>
    );
  }

  // if (isManager()) {
  //   return (
  //     <MainLayout>
  //       <Tabs defaultValue="my-courses" className="space-y-4">
  //         <TabsList className="grid w-full max-w-md grid-cols-2">
  //           <TabsTrigger value="my-courses" className="gap-2">
  //             <GraduationCap className="w-4 h-4" />
  //             Meus Cursos
  //           </TabsTrigger>
  //           <TabsTrigger value="manage" className="gap-2">
  //             <LayoutList className="w-4 h-4" />
  //             Cursos / Treinamentos
  //           </TabsTrigger>
  //         </TabsList>
  //         <TabsContent value="my-courses">
  //           <CoursesEmployee />
  //         </TabsContent>
  //         <TabsContent value="manage">
  //           <CoursesAdmin />
  //         </TabsContent>
  //       </Tabs>
  //     </MainLayout>
  //   );
  // }

  return (
    <MainLayout>
      <CoursesEmployee />
    </MainLayout>
  );
}
