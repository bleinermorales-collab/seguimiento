interface Step {
  number: number;
  label: string;
}

const STEPS: Step[] = [
  { number: 1, label: 'Información' },
  { number: 2, label: 'Estado' },
  { number: 3, label: 'Confirmar' },
];

export default function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center mb-8 px-4">
      {STEPS.map((step, i) => {
        const isActive = step.number === current;
        const isDone = step.number < current;
        return (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md'
                    : isDone
                    ? 'bg-indigo-200 text-indigo-700'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {isDone ? (
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`mt-1.5 text-xs font-medium ${
                  isActive ? 'text-indigo-600' : isDone ? 'text-indigo-400' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-24 h-0.5 mx-1 mb-5 transition-all ${
                  current > step.number ? 'bg-indigo-300' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
