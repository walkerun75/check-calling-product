import SetupCompletion from "./setup-completion";

export default function LaunchLayout({children}:{children:React.ReactNode}){
  return <>{children}<SetupCompletion/></>;
}
