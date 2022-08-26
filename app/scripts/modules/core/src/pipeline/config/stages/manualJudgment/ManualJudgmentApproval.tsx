import React, { ChangeEvent } from 'react';
import Select, { Option } from 'react-select';

import { Application } from 'core/application/application.model';
import { ApplicationReader } from 'core/application/service/ApplicationReader';
import { AuthenticationService } from 'core/authentication';
import { IExecution, IExecutionStage } from 'core/domain';
import { Markdown } from 'core/presentation/Markdown';
import { NgReact, ReactInjector } from 'core/reactShims';

export interface IManualJudgmentApprovalProps {
  execution: IExecution;
  stage: IExecutionStage;
  application: Application;
}

export interface IManualJudgmentApprovalState {
  submitting: boolean;
  judgmentDecision: string;
  judgmentInput: { value?: string };
  judgmentFreeformInput: { value?: string };
  applicationRoles: { READ?: string[]; WRITE?: string[]; EXECUTE?: string[]; CREATE?: string[] };
  userRoles: string[];
  error: boolean;
}

export class ManualJudgmentApproval extends React.Component<
  IManualJudgmentApprovalProps,
  IManualJudgmentApprovalState
> {
  constructor(props: IManualJudgmentApprovalProps) {
    super(props);
    this.state = {
      submitting: false,
      judgmentDecision: null,
      judgmentInput: {},
      judgmentFreeformInput: {},
      applicationRoles: {},
      userRoles: [],
      error: false,
    };
  }

  public componentDidMount() {
    const applicationName = this.props.execution.application;
    ApplicationReader.getApplicationPermissions(applicationName).then((result) => {
      if (result) {
        this.setState({
          applicationRoles: result,
        });
      }
    });
    this.setState({
      userRoles: AuthenticationService.getAuthenticatedUser().roles,
    });
  }

  private provideJudgment(judgmentDecision: string): void {
    const { application, execution, stage } = this.props;
    const judgmentInput: string = this.state.judgmentInput ? this.state.judgmentInput.value : null;
    const judgmentFreeformInput: string = this.state.judgmentFreeformInput
      ? this.state.judgmentFreeformInput.value
      : null;
    this.setState({ submitting: true, error: false, judgmentDecision });
    ReactInjector.manualJudgmentService.provideJudgment(
      application,
      execution,
      stage,
      judgmentDecision,
      judgmentInput,
      judgmentFreeformInput,
    );
  }

  private isManualJudgmentStageNotAuthorized(): boolean {
    let isStageNotAuthorized = true;
    let returnOnceFalse = true;
    const { applicationRoles, userRoles } = this.state;
    const stageRoles = this.props.stage?.context?.selectedStageRoles || [];
    if (!stageRoles.length) {
      isStageNotAuthorized = false;
      return isStageNotAuthorized;
    }
    const { CREATE, EXECUTE, WRITE } = applicationRoles;
    userRoles.forEach((userRole) => {
      if (returnOnceFalse) {
        if (stageRoles.includes(userRole)) {
          isStageNotAuthorized =
            (WRITE || []).includes(userRole) || (EXECUTE || []).includes(userRole) || (CREATE || []).includes(userRole);
          if (isStageNotAuthorized) {
            isStageNotAuthorized = false;
            returnOnceFalse = false;
          } else {
            isStageNotAuthorized = true;
          }
        }
      }
    });
    return isStageNotAuthorized;
  }

  private isSubmitting(decision: string): boolean {
    return (
      this.props.stage.context.judgmentStatus === decision ||
      (this.state.submitting && this.state.judgmentDecision === decision)
    );
  }

  private handleJudgementChanged = (option: Option): void => {
    this.setState({ judgmentInput: { value: option.value as string } });
  };

  private handleFreeformInputChanged = (inputEvent: ChangeEvent<HTMLInputElement>): void => {
    this.setState({ judgmentFreeformInput: { value: inputEvent.target.value } });
  };

  private handleContinueClick = (): void => {
    this.provideJudgment('continue');
  };

  private handleStopClick = (): void => {
    this.provideJudgment('stop');
  };

  public render(): React.ReactElement<ManualJudgmentApproval> {
    const stage: IExecutionStage = this.props.stage;
    const status: string = stage.status;

    const options: Option[] = (stage.context.judgmentInputs || []).map((o: { value: string }) => {
      return { value: o.value, label: o.value };
    });

    const inputMetadata: HTMLInputElement[] = (stage.context.judgmentFreeformInputs || []).map(
      (i: { value: string }) => {
        return { value: i.value, label: i.value };
      },
    );

    const showOptions =
      !['SKIPPED', 'SUCCEEDED'].includes(status) && (!stage.context.judgmentStatus || status === 'RUNNING');

    const hasInstructions = !!stage.context.instructions;
    const { ButtonBusyIndicator } = NgReact;

    return (
      <div>
        {hasInstructions && (
          <div>
            <div>
              <b>Instructions</b>
            </div>
            <Markdown message={stage.context.instructions} />
          </div>
        )}
        {showOptions && (
          <div>
            {options.length > 0 && (
              <div>
                <p>
                  <b>Judgment Input</b>
                </p>
                <Select
                  options={options}
                  clearable={false}
                  value={this.state.judgmentInput.value}
                  onChange={this.handleJudgementChanged}
                />
              </div>
            )}
            {inputMetadata.length > 0 && (
              <div>
                <br />
                <p>
                  <b>{stage.context.judgmentFreeformInputs[0].value}</b>
                </p>
                <input
                  type="text"
                  value={this.state.judgmentFreeformInput.value}
                  onChange={this.handleFreeformInputChanged}
                />
              </div>
            )}
            <div className="action-buttons">
              <button
                className="btn btn-danger"
                onClick={this.handleStopClick}
                disabled={
                  this.isManualJudgmentStageNotAuthorized() ||
                  this.state.submitting ||
                  stage.context.judgmentStatus ||
                  (options.length && !this.state.judgmentInput.value) ||
                  (inputMetadata.length && !this.state.judgmentFreeformInput.value)
                }
              >
                {this.isSubmitting('stop') && <ButtonBusyIndicator />}
                {stage.context.stopButtonLabel || 'Stop'}
              </button>
              <button
                className="btn btn-primary"
                disabled={
                  this.isManualJudgmentStageNotAuthorized() ||
                  this.state.submitting ||
                  stage.context.judgmentStatus ||
                  (options.length && !this.state.judgmentInput.value) ||
                  (inputMetadata.length && !this.state.judgmentFreeformInput.value)
                }
                onClick={this.handleContinueClick}
              >
                {this.isSubmitting('continue') && <ButtonBusyIndicator />}
                {stage.context.continueButtonLabel || 'Continue'}
              </button>
            </div>
          </div>
        )}
        {this.state.error && (
          <div className="error-message">There was an error recording your decision. Please try again.</div>
        )}
      </div>
    );
  }
}
