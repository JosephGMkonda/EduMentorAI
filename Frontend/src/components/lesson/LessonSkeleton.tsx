const SkeletonLine = ({ w = "100%" }: { w?: string }) => (
  <div
    className="h-3.5 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse"
    style={{ width: w }}
  />
);

const LessonSkeleton = () => (
  <div className="space-y-6">
    <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
        <div className="space-y-2 flex-1">
          <div className="h-5 w-1/3 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="h-3 w-1/4 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
        </div>
      </div>
    </div>

    <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-6 w-40 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
        <div className="h-9 w-32 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
      </div>
      <SkeletonLine />
      <SkeletonLine w="95%" />
      <SkeletonLine w="90%" />
      <div className="pt-2 space-y-3">
        <SkeletonLine w="70%" />
        <SkeletonLine w="85%" />
        <SkeletonLine w="75%" />
        <SkeletonLine w="92%" />
        <SkeletonLine w="60%" />
      </div>
      <div className="h-64 rounded-xl bg-slate-100 dark:bg-slate-700/60 animate-pulse" />
      <div className="pt-2 space-y-3">
        <SkeletonLine w="88%" />
        <SkeletonLine w="78%" />
        <SkeletonLine w="94%" />
      </div>
    </div>
  </div>
);

export default LessonSkeleton;
