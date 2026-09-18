import { CooperativePage } from '../_components/cooperative-page'
export const dynamic='force-dynamic'
export default async function Page({searchParams}:{searchParams:Promise<{q?:string;p?:string;sort?:string;dir?:string;from?:string;to?:string;tool?:string}>}){return <CooperativePage view="bills" searchParams={searchParams}/>}
