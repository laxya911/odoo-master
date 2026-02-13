// import { Suspense } from 'react';
// import { CustomersClient } from './customers-client';
// import { CustomersLoading } from './loading';
// import type { Paginated, Partner, OdooError } from '@/lib/types';
// import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
// import { AlertTriangle } from 'lucide-react';

// async function getCustomers(searchParams: URLSearchParams): Promise<Paginated<Partner> | { error: OdooError }> {
//   const url = new URL(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/odoo/partners`);
//   url.search = searchParams.toString();

//   try {
//     const res = await fetch(url.toString(), { cache: 'no-store' });
//     if (!res.ok) {
//       const contentType = res.headers.get("content-type");
//       let errorMessage;
//       if (contentType && contentType.indexOf("application/json") !== -1) {
//         const errorBody = await res.json();
//         errorMessage = errorBody.message || 'An unknown API error occurred';
//       } else {
//         errorMessage = await res.text();
//       }
//       return { error: { message: errorMessage, status: res.status } };
//     }
//     return res.json();
//   } catch (e) {
//     const error = e as Error;
//     return { error: { message: error.message, status: 500 } };
//   }
// }

// export default async function CustomersPage({
//   searchParams,
// }: {
//   searchParams: { [key: string]: string | string[] | undefined };
// }) {
//   const params = new URLSearchParams(JSON.parse(JSON.stringify(searchParams)));
//   const customersData = await getCustomers(params);

//   if ('error' in customersData) {
//     return (
//       <Alert variant="destructive">
//         <AlertTriangle className="h-4 w-4" />
//         <AlertTitle>Error fetching customers</AlertTitle>
//         <AlertDescription>{customersData.error.message}</AlertDescription>
//       </Alert>
//     );
//   }

//   return (
//     <Suspense fallback={<CustomersLoading />}>
//       <CustomersClient initialData={customersData} />
//     </Suspense>
//   );
// }


// src/app/(main)/customers/page.tsx
import { Suspense } from "react";
import { CustomersClient } from "./customers-client";
import { CustomersLoading } from "./loading";
import type { Paginated, Partner, OdooError } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

// async function getCustomers(
//   params: { q?: string; limit?: string; offset?: string }
// ): Promise<Paginated<Partner> | { error: OdooError }> {
//   const baseUrl =
//     process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

//   const url = new URL(`${baseUrl}/api/odoo/partners`);
//   const search = new URLSearchParams();

//   if (params.q) search.set("q", params.q);
//   if (params.limit) search.set("limit", params.limit);
//   if (params.offset) search.set("offset", params.offset);

//   url.search = search.toString();

//   try {
//     const res = await fetch(url.toString(), { cache: "no-store" });
//     if (!res.ok) {
//       const contentType = res.headers.get("content-type");
//       let errorMessage;
//       if (contentType?.includes("application/json")) {
//         const errorBody = await res.json();
//         errorMessage =
//           errorBody.message || "An unknown API error occurred";
//       } else {
//         errorMessage = await res.text();
//       }
//       return { error: { message: errorMessage, status: res.status } };
//     }
//     return res.json();
//   } catch (e) {
//     const error = e as Error;
//     return { error: { message: error.message, status: 500 } };
//   }
// }

async function getCustomers(
  params: { q?: string; limit?: string; offset?: string }
): Promise<Paginated<Partner> | { error: OdooError }> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const url = new URL(`${baseUrl}/api/odoo/partners`);
  const search = new URLSearchParams();

  if (params.q) search.set("q", params.q);
  if (params.limit) search.set("limit", params.limit);
  if (params.offset) search.set("offset", params.offset);

  url.search = search.toString();

  console.log("[CustomersPage] fetching:", url.toString());

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });

    console.log("[CustomersPage] status:", res.status);

    if (!res.ok) {
      const contentType = res.headers.get("content-type");
      let errorMessage;
      if (contentType?.includes("application/json")) {
        const errorBody = await res.json();
        console.log("[CustomersPage] error body:", errorBody);
        errorMessage =
          errorBody.message || "An unknown API error occurred";
      } else {
        const text = await res.text();
        console.log("[CustomersPage] error text:", text);
        errorMessage = text;
      }
      return { error: { message: errorMessage, status: res.status } };
    }

    const json = await res.json();
    console.log("[CustomersPage] response sample:", {
      meta: json?.meta,
      first: json?.data?.[0],
    });
    return json;
  } catch (e) {
    const error = e as Error;
    console.error("[CustomersPage] fetch error:", error);
    return { error: { message: error.message, status: 500 } };
  }
}


type CustomersPageProps = {
  // Next 15/16: searchParams is async
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
};

export default async function CustomersPage(props: CustomersPageProps) {
  const raw = await props.searchParams;

  const q = typeof raw.q === "string" ? raw.q : undefined;
  const limit = typeof raw.limit === "string" ? raw.limit : undefined;
  const offset = typeof raw.offset === "string" ? raw.offset : undefined;

  const customersData = await getCustomers({ q, limit, offset });

  if ("error" in customersData) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error fetching customers</AlertTitle>
        <AlertDescription>{customersData.error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Suspense fallback={<CustomersLoading />}>
      <CustomersClient initialData={customersData} />
    </Suspense>
  );
}
