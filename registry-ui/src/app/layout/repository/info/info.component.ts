import {Component, OnInit, ElementRef, Injector} from '@angular/core';
import {PageComponent} from "../../../common/component/page.component";
import {Repository} from "../repository.value";
import {RepositoryService} from "../repository.service";
import {Build} from "../build-history/build-history.value";
import {BuildHistoryService} from "../build-history/build-history.service";
import * as moment from "moment";
import {Utils} from "../../../common/utils/utils";
import {CommonConstant} from "../../../common/constant/common-constant";
import {Alert} from "../../../common/utils/alert-util";
import {environment} from "../../../../environments/environment";
import {UserService} from "../../user/user.service";
import {Tag} from "../tag-info/tag.value";
import {TagService} from "../tag-info/tag.service";
import * as _ from "lodash";

@Component({
  selector: 'info',
  templateUrl: 'info.component.html'
})
export class InfoComponent extends PageComponent implements OnInit {

  public Phase: typeof Build.Phase = Build.Phase;

  public mine: boolean = true;

  public repo: Repository.Entity = new Repository.Entity();
  public orgName: string;
  public repoName: string;

  public sortProperty: string;
  public sortDirection: string;

  public dockerPullCommand: string;

  public buildHistoryList: Array<Build.Entity> = [];

  public currentBuildId: string;
  public showBuildDetailPopup: boolean = false;

  public tagList: Tag.Entity[] = [];
  public currentSelectedTag: Tag.Entity = new Tag.Entity();
  public selectedImageId: string;
  public showTagSecurityPopup: boolean = false;

  public showBuildPopup: boolean = false;

  public securityData: Object = {};

  constructor(protected elementRef: ElementRef,
              protected injector: Injector,
              private userService: UserService,
              private repositoryService: RepositoryService,
              private tagService: TagService,
              public buildHistoryService: BuildHistoryService) {

    super(elementRef, injector);
  }

  ngOnInit() {
    // parameter 가져오기
    this.subscriptions.push(
      this.activatedRoute.params
        .subscribe(params => {
          if (params[ 'org' ]) {
            this.orgName = params[ 'org' ];
          }

          if (params[ 'repo' ]) {
            this.repoName = params[ 'repo' ];
          }

          this.dockerPullCommand = `docker pull ${this.userService.user.registryUrl}/${this.orgName}/${this.repoName}`;

          this.getRepository();
          this.getBuildHistory();
        })
    );

    this.subscriptions.push(
      this.buildHistoryService.newBuild.subscribe(
        value => {
          this.getBuildHistory();
        }
      )
    );

    this.subscriptions.push(
      this.commonService.lnbWriter.subscribe(
        value => {
          this.mine = value;
        }
      )
    );
  }

  /**
   * docker pull command 복사
   */
  public dockerPullCommandCopyClick() {
    Utils.StringUtil.copyToClipboard(this.dockerPullCommand);

    Alert.success(CommonConstant.MESSAGE.COPIED);
  }

  /**
   * history view more 클릭
   */
  public historyViewMoreClick() {
    this.router.navigate([`app/image/${this.orgName}/${this.repoName}/build`]);
  }

  /**
   * tag view more 클릭
   */
  public tagViewMoreClick() {
    this.router.navigate([`app/image/${this.orgName}/${this.repoName}/tag-info`]);
  }

  /**
   * 정렬
   * @param colName
   * @param sort
   */
  public sortClick(property: string) {
    if (this.sortProperty == property) {
      this.sortDirection = this.sortDirection == 'desc' ? 'asc' : 'desc';
    } else {
      this.sortDirection = 'desc';
    }
    this.sortProperty = property;
  }

  /**
   * popup build detail
   * @param item
   */
  public popupBuildDetail(item: Build.Entity) {
    if (!this.mine) {
      return;
    }

    this.currentBuildId = item.id;
    this.showBuildDetailPopup = true;
  }

  public buildDetailPopupClose() {
    this.showBuildDetailPopup = false;
  }

  public startNewBuildClick() {
    this.showBuildPopup = true;
  }

  public buildPopupClose() {
    this.showBuildPopup = false;
  }

  /**
   * save click
   */
  public saveClick() {
    this.repositoryService.updateRepository(this.orgName, this.repoName, this.repo).then(result => {
      Alert.success(CommonConstant.MESSAGE.SUCCESS);
    });
  }

  /**
   * scan 클릭
   * @param tag
   */
  public scanClick(tag: Tag.Entity) {
    this.currentSelectedTag = tag;
    this.selectedImageId = tag.dockerImageId;
    this.showTagSecurityPopup = true;
  }

  /**
   * repository 상세 조회
   */
  private getRepository() {
    this.repositoryService.getRepository(`${this.orgName}/${this.repoName}`).then(result => {
      this.repo = result;

      this.tagList = [];

      result.tags = Array.from(result.tags).sort(function(a, b) {
        // 내림차순
        return a.lastModified > b.lastModified ? -1 : a.lastModified < b.lastModified ? 1 : 0;
      });
      Array.from(result.tags).forEach((value, index) => {
        if (index > 4) {
          return;
        }

        this.tagList.push(value);
      });

      this.loaderService.show.next(false);

      // dockerImageId 로 중복 제거
      let imageList = _.uniqBy(this.tagList, 'dockerImageId');
      imageList.forEach(value => {
        this.getSecurityData(value.dockerImageId, value.name);
      });
    });
  }

  /**
   * build history 조회
   */
  private getBuildHistory() {
    this.loaderService.show.next(true);

    this.repositoryService.getBuildHistory(this.orgName, this.repoName, 5).then(result => {
      result.builds.forEach(value => {
        value.formattedStarted = moment(value.started).format('YYYY-MM-DD HH:mm');
      });
      this.buildHistoryList = result.builds;

      this.loaderService.show.next(false);
    });
  }

  /**
   * security scan 조회
   * @param imageId
   */
  private getSecurityData(imageId: string, tagName: string) {
    this.tagService.getSecurity(this.orgName, this.repoName, tagName).then(result => {
      this.tagService.setSecurityCount(result);

      this.securityData[imageId] = result;

    });
  }

  /**
   * image id 로 security data 가져오기
   * @param imageId
   * @returns {any}
   */
  public getSecurity(imageId: string) {
    let security = this.securityData[imageId];

    return security;
  }

}
