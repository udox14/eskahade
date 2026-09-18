import { CooperativePage } from './_components/cooperative-page'
import { CentralModuleOverview } from './_components/module-overview'
export const dynamic='force-dynamic'
export default async function Page({searchParams}:{searchParams:Promise<{q?:string;p?:string;sort?:string;dir?:string;from?:string;to?:string;tool?:string}>}){return <><CooperativePage view="home" searchParams={searchParams}/><CentralModuleOverview /></>}
