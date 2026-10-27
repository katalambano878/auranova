import { ContentPage, contentMetadata } from "@/components/store/content-page";
export const generateMetadata = () => contentMetadata("returns");
export default function Page() { return <ContentPage slug="returns" />; }
