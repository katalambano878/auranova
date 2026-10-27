import { ContentPage, contentMetadata } from "@/components/store/content-page";
export const generateMetadata = () => contentMetadata("shipping");
export default function Page() { return <ContentPage slug="shipping" />; }
