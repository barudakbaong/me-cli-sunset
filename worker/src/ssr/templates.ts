import accountsTemplate from "./templates/accounts.html";
import baseTemplate from "./templates/base.html";
import bookmarkTemplate from "./templates/bookmark.html";
import dashboardTemplate from "./templates/dashboard.html";
import errorBodyTemplate from "./templates/error_body.html";
import familyDetailTemplate from "./templates/family_detail.html";
import familyLoopTemplate from "./templates/family_loop.html";
import familyLoopStreamTemplate from "./templates/family_loop_stream.html";
import hotTemplate from "./templates/hot.html";
import loginTemplate from "./templates/login.html";
import myPackagesTemplate from "./templates/my_packages.html";
import packageDetailTemplate from "./templates/package_detail.html";
import packagesInputCodeTemplate from "./templates/packages_input_code.html";
import purchaseJobStatusTemplate from "./templates/purchase_job_status.html";
import purchaseResultTemplate from "./templates/purchase_result.html";
import storeFamiliesTemplate from "./templates/store_families.html";
import storePackagesTemplate from "./templates/store_packages.html";
import storeRedemablesTemplate from "./templates/store_redemables.html";
import storeSegmentsTemplate from "./templates/store_segments.html";
import webuiLoginTemplate from "./templates/webui_login.html";

export const TEMPLATES: Record<string, string> = {
  base: baseTemplate,
  webui_login: webuiLoginTemplate,
  error_body: errorBodyTemplate,
  login: loginTemplate,
  dashboard: dashboardTemplate,
  accounts: accountsTemplate,
  packages_input_code: packagesInputCodeTemplate,
  package_detail: packageDetailTemplate,
  family_detail: familyDetailTemplate,
  family_loop: familyLoopTemplate,
  family_loop_stream: familyLoopStreamTemplate,
  my_packages: myPackagesTemplate,
  hot: hotTemplate,
  bookmark: bookmarkTemplate,
  store_segments: storeSegmentsTemplate,
  store_families: storeFamiliesTemplate,
  store_packages: storePackagesTemplate,
  store_redemables: storeRedemablesTemplate,
  purchase_result: purchaseResultTemplate,
  purchase_job_status: purchaseJobStatusTemplate,
};